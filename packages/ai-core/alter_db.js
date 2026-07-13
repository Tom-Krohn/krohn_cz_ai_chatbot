import fs from 'fs';
import path from 'path';
import pg from 'pg';

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
	const pool = new Pool({ connectionString: env.DATABASE_URL });
	try {
		console.log('Dropping approximate nearest neighbor index (ivfflat)...');
		await pool.query('DROP INDEX IF EXISTS product_embeddings_vector_idx');
		console.log('Index dropped successfully. DB will now use exact nearest neighbor matching.');
	} catch (err) {
		console.error('Error altering DB:', err);
	} finally {
		await pool.end();
	}
}

main().catch(console.error);
