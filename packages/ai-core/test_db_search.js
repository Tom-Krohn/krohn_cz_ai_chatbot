import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';

const { Pool } = pg;

// Parse .env from workspace root
const envPath = path.resolve('../../.env');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
	const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
	if (match) {
		let value = match[2] ? match[2].trim() : '';
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		if (value.startsWith("'") && value.endsWith("'")) {
			value = value.slice(1, -1);
		}
		env[match[1]] = value;
	}
});

async function main() {
	const dbUrl = env.DATABASE_URL;
	const geminiKey = env.GEMINI_API_KEY;
	const openaiKey = env.OPENAI_API_KEY;

	console.log('Database URL:', dbUrl ? 'Present' : 'Missing');
	console.log('Gemini Key:', geminiKey ? 'Present' : 'Missing');
	console.log('OpenAI Key:', openaiKey ? 'Present' : 'Missing');

	const pool = new Pool({ connectionString: dbUrl });

	// 1. Check database count
	const countRes = await pool.query('SELECT count(*) FROM products');
	const embCountRes = await pool.query('SELECT count(*) FROM product_embeddings');
	console.log(`Total products: ${countRes.rows[0].count}`);
	console.log(`Total embeddings: ${embCountRes.rows[0].count}`);

	// 2. Generate embedding for query "jaké máš sklopce?"
	let embedding;
	if (geminiKey) {
		console.log('\nGenerating embedding with Gemini...');
		const google = createGoogleGenerativeAI({ apiKey: geminiKey });
		const { embedding: emb } = await embed({
			model: google.textEmbeddingModel('gemini-embedding-001'),
			value: 'jaké máš sklopce?',
			providerOptions: { google: { outputDimensionality: 768 } },
		});
		embedding = emb;
	} else if (openaiKey) {
		console.log('\nGenerating embedding with OpenAI...');
		const openai = createOpenAI({ apiKey: openaiKey });
		const { embedding: emb } = await embed({
			model: openai.textEmbeddingModel('text-embedding-3-small'),
			value: 'jaké máš sklopce?',
			dimensions: 768,
		});
		embedding = emb;
	} else {
		console.error('No API keys found to generate embedding.');
		await pool.end();
		return;
	}

	console.log('Embedding generated. Length:', embedding.length);

	// 3. Search RAG
	const vectorStr = `[${embedding.join(',')}]`;
	const searchRes = await pool.query(
		`SELECT pe.chunk_text, p.title, 
		        (1 - (pe.embedding <=> $1::vector)) as similarity
		 FROM product_embeddings pe
		 JOIN products p ON pe.product_id = p.id
		 ORDER BY similarity DESC
		 LIMIT 15`,
		[vectorStr]
	);

	console.log('\nTop 15 semantic search results (ordered by similarity DESC):');
	searchRes.rows.forEach((row, idx) => {
		console.log(`${idx + 1}. [Sim: ${(row.similarity * 100).toFixed(1)}%] Title: "${row.title}"`);
		console.log(`   Chunk snippet: "${row.chunk_text.slice(0, 100)}..."`);
	});

	await pool.end();
}

main().catch(console.error);
