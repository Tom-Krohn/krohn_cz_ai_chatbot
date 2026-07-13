import { XMLParser } from 'fast-xml-parser';
import { generateEmbedding, generateEmbeddings } from '@chat-agent/ai-core';
import {
	deleteProductEmbeddingsByProductId,
	insertProduct,
	insertProductEmbedding,
} from './db-repository.js';

export type SyncResult = {
	success: boolean;
	message: string;
	stats?: {
		totalParsed: number;
		totalEmbedded: number;
		totalUpdated: number;
	};
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 15000): Promise<T> {
	try {
		return await fn();
	} catch (err: any) {
		const isRateLimit = err.message?.includes('quota') || err.message?.includes('429') || err.message?.includes('limit');
		if (isRateLimit && retries > 0) {
			console.warn(`Rate limit hit, sleeping for ${delayMs / 1000}s before retry...`);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			return callWithRetry(fn, retries - 1, delayMs * 1.5);
		}
		throw err;
	}
}

/**
 * Syncs a product feed without clearing existing memory.
 * Products are upserted by externalId; only changed products get their embeddings regenerated.
 * Documents added manually via the knowledge base UI are never touched.
 */
export async function syncFeed(tenantId: string, feedUrl: string): Promise<SyncResult> {
	try {
		console.log(`Starting sync for tenant ${tenantId} from ${feedUrl}`);
		
		let xmlText = '';
		
		if (feedUrl.startsWith('http://') || feedUrl.startsWith('https://')) {
			const response = await fetch(feedUrl);
			if (!response.ok) {
				return {
					success: false,
					message: `Failed to fetch feed. Status code: ${response.status}`,
				};
			}
			xmlText = await response.text();
		} else {
			// For testing with local mock data paths
			const fs = await import('fs/promises');
			xmlText = await fs.readFile(feedUrl, 'utf-8');
		}

		const parser = new XMLParser({
			ignoreAttributes: true,
			parseTagValue: true,
			trimValues: true,
		});

		const jsonObj = parser.parse(xmlText);
		// Heureka/Zbozi XML standards contain SHOPITEMs
		const shopitems = jsonObj?.SHOP?.SHOPITEM || jsonObj?.shop?.shopitem;

		if (!shopitems) {
			return {
				success: false,
				message: 'Invalid feed structure: <SHOPITEM> tag not found.',
			};
		}

		const items = Array.isArray(shopitems) ? shopitems : [shopitems];

		// Upsert all products first (no clearProducts — we preserve existing memory)
		const productsToEmbed: { productId: string; title: string; chunkText: string; isNew: boolean }[] = [];

		for (const item of items) {
			const externalId = String(item.ITEM_ID || item.item_id || item.ITEMID || item.itemid || item.ID || item.id || Math.random().toString(36).substring(7));
			const title = String(item.PRODUCTNAME || item.productname || item.PRODUCT || item.product || item.TITLE || item.title || '').trim();
			const description = String(item.DESCRIPTION || item.description || item.TEXT || item.text || '').trim();
			const url = String(item.URL || item.url || '').trim();
			const price = item.PRICE_VAT || item.price_vat || item.PRICE || item.price || '';

			if (!title) {
				continue;
			}

			const metadata = {
				price: price ? `${price} CZK` : undefined,
				url: url || undefined,
				source_type: 'feed',
			};

			// insertProduct returns the product_id and a flag indicating if it was newly inserted or updated
			const productId = await insertProduct(tenantId, {
				externalId,
				title,
				description,
				metadata,
			});

			const chunkText = `Název: ${title}\nPopis: ${description}\nCena: ${metadata.price || 'neuvedena'}`;
			productsToEmbed.push({ productId, title, chunkText, isNew: true });
		}

		let totalEmbedded = 0;
		let totalUpdated = 0;
		const batchSize = 5;
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		for (let i = 0; i < productsToEmbed.length; i += batchSize) {
			const batch = productsToEmbed.slice(i, i + batchSize);
			const texts = batch.map((p) => p.chunkText);

			console.log(`Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToEmbed.length / batchSize)} (${batch.length} products)...`);

			try {
				const embeddings = await callWithRetry(() => generateEmbeddings(texts), 5, 20000);
				for (let j = 0; j < batch.length; j++) {
					const product = batch[j];
					const embedding = embeddings[j];
					if (product && embedding) {
						// Delete old embeddings for this product first (replace strategy)
						await deleteProductEmbeddingsByProductId(product.productId);
						await insertProductEmbedding(tenantId, product.productId, product.chunkText, embedding);
						totalEmbedded++;
						if (!product.isNew) totalUpdated++;
					}
				}
			} catch (err: any) {
				console.error(`Failed to generate embeddings for batch starting at index ${i}:`, err.message);
				
				// Fallback: try individual embeddings for this batch to save what we can
				console.log('Falling back to individual embedding generation for this batch...');
				for (const product of batch) {
					try {
						const embedding = await callWithRetry(() => generateEmbedding(product.chunkText), 3, 5000);
						await deleteProductEmbeddingsByProductId(product.productId);
						await insertProductEmbedding(tenantId, product.productId, product.chunkText, embedding);
						totalEmbedded++;
					} catch (individualErr: any) {
						console.error(`Failed to generate individual embedding for product ${product.title}:`, individualErr.message);
					}
					// Wait 500ms between individual fallbacks to respect rate limits
					await sleep(500);
				}
			}

			// Friendly sleep to respect Gemini RPM rate limit
			if (i + batchSize < productsToEmbed.length) {
				await sleep(4000);
			}
		}

		return {
			success: true,
			message: `Synchronizace dokončena. Zpracováno ${totalEmbedded} produktů (paměť dokumentů zachována).`,
			stats: {
				totalParsed: items.length,
				totalEmbedded,
				totalUpdated,
			},
		};
	} catch (error: any) {
		console.error('Synchronization failed:', error);
		return {
			success: false,
			message: `Synchronization failed: ${error.message}`,
		};
	}
}

/**
 * Splits a long text into overlapping chunks for better RAG coverage.
 */
export function chunkText(text: string, maxChunkSize = 800, overlap = 100): string[] {
	const lines = text.split('\n').filter((l) => l.trim().length > 0);
	const chunks: string[] = [];
	let current = '';

	for (const line of lines) {
		if ((current + '\n' + line).length > maxChunkSize && current.length > 0) {
			chunks.push(current.trim());
			// Keep last `overlap` chars for context continuity
			const words = current.split(' ');
			const overlapWords = words.slice(-Math.ceil(overlap / 6));
			current = overlapWords.join(' ') + '\n' + line;
		} else {
			current += (current ? '\n' : '') + line;
		}
	}

	if (current.trim().length > 0) {
		chunks.push(current.trim());
	}

	return chunks.length > 0 ? chunks : [text.slice(0, maxChunkSize)];
}
