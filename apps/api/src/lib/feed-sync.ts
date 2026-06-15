import { XMLParser } from 'fast-xml-parser';
import { generateEmbedding } from '@chat-agent/ai-core';
import { clearProducts, insertProduct, insertProductEmbedding } from './db-repository.js';

export type SyncResult = {
	success: boolean;
	message: string;
	stats?: {
		totalParsed: number;
		totalEmbedded: number;
	};
};

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

		// Clear old products first for a clean rebuild
		await clearProducts(tenantId);

		let totalEmbedded = 0;

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
			};

			const productId = await insertProduct(tenantId, {
				externalId,
				title,
				description,
				metadata,
			});

			const chunkText = `Název: ${title}\nPopis: ${description}\nCena: ${metadata.price || 'neuvedena'}`;
			try {
				const embedding = await generateEmbedding(chunkText);
				await insertProductEmbedding(tenantId, productId, chunkText, embedding);
				totalEmbedded++;
			} catch (err: any) {
				console.error(`Failed to generate embedding for product ${title}:`, err.message);
			}
		}

		return {
			success: true,
			message: `Synchronization complete. Ingested ${totalEmbedded} products.`,
			stats: {
				totalParsed: items.length,
				totalEmbedded,
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
