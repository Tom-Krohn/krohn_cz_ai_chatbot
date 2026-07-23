import crypto from 'crypto';
import { query } from './db.js';

export type IngestionJobStatus = 'queued' | 'running' | 'done' | 'failed';

export type IngestionJobStats = {
	processed?: number;
	total?: number;
	percent?: number;
	failed?: number;
	totalParsed?: number;
	totalEmbedded?: number;
	totalUpdated?: number;
	errorMessage?: string;
	startedAt?: string;
	finishedAt?: string;
};

export type IngestionJobRecord = {
	id: string;
	status: IngestionJobStatus;
	sourceType: string;
	stats: IngestionJobStats;
	createdAt: string;
	updatedAt: string;
};

export function getTenantUuid(slug: string): string {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (uuidRegex.test(slug)) {
		return slug.toLowerCase();
	}
	const hash = crypto.createHash('sha1').update(slug).digest('hex');
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function ensureTenant(tenantId: string, name = 'Default Tenant'): Promise<string> {
	const uuid = getTenantUuid(tenantId);

	// Ensure tenant exists
	await query(
		`INSERT INTO tenants (id, name) 
		 VALUES ($1, $2) 
		 ON CONFLICT (id) DO NOTHING`,
		[uuid, name]
	);

	// Ensure default settings exist
	await query(
		`INSERT INTO tenant_settings (tenant_id, connector_platform, llm_provider, llm_model, llm_api_key_alias, abuse_protection_enabled)
		 VALUES ($1, 'custom-feed', 'openai', 'gpt-4o-mini', 'default-key', true)
		 ON CONFLICT (tenant_id) DO NOTHING`,
		[uuid]
	);

	// Ensure default abuse policy exists
	await query(
		`INSERT INTO abuse_policies (tenant_id, soft_daily_token_limit, hard_daily_token_limit, hourly_message_limit_per_ip, hourly_message_limit_per_tenant, max_input_chars)
		 VALUES ($1, 80000, 120000, 60, 600, 2000)
		 ON CONFLICT (tenant_id) DO NOTHING`,
		[uuid]
	);

	return uuid;
}

export async function getTenantSettings(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	await ensureTenant(tenantId);

	const res = await query(
		`SELECT connector_platform, product_api_url, product_feed_url, shoptet_premium, llm_provider, llm_model, llm_api_key_alias, abuse_protection_enabled
		 FROM tenant_settings
		 WHERE tenant_id = $1`,
		[uuid]
	);

	const row = res.rows[0];
	if (!row) return null;

	return {
		abuseProtectionEnabled: row.abuse_protection_enabled,
		connector: {
			platform: row.connector_platform,
			productApiUrl: row.product_api_url || undefined,
			productFeedUrl: row.product_feed_url || undefined,
			shoptetPremium: row.shoptet_premium,
		},
		llm: {
			apiKeyAlias: row.llm_api_key_alias,
			model: row.llm_model,
			provider: row.llm_provider,
		},
	};
}

export async function upsertTenantSettings(tenantId: string, settings: any) {
	const uuid = getTenantUuid(tenantId);
	await ensureTenant(tenantId);

	await query(
		`INSERT INTO tenant_settings (tenant_id, connector_platform, product_api_url, product_feed_url, shoptet_premium, llm_provider, llm_model, llm_api_key_alias, abuse_protection_enabled, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		 ON CONFLICT (tenant_id) DO UPDATE SET
			connector_platform = EXCLUDED.connector_platform,
			product_api_url = EXCLUDED.product_api_url,
			product_feed_url = EXCLUDED.product_feed_url,
			shoptet_premium = EXCLUDED.shoptet_premium,
			llm_provider = EXCLUDED.llm_provider,
			llm_model = EXCLUDED.llm_model,
			llm_api_key_alias = EXCLUDED.llm_api_key_alias,
			abuse_protection_enabled = EXCLUDED.abuse_protection_enabled,
			updated_at = NOW()`,
		[
			uuid,
			settings.connector?.platform || 'custom-feed',
			settings.connector?.productApiUrl || null,
			settings.connector?.productFeedUrl || null,
			settings.connector?.shoptetPremium || false,
			settings.llm?.provider || 'openai',
			settings.llm?.model || 'gpt-4o-mini',
			settings.llm?.apiKeyAlias || 'default-key',
			settings.abuseProtectionEnabled ?? true,
		]
	);
}

export async function getAbusePolicy(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	await ensureTenant(tenantId);

	const res = await query(
		`SELECT soft_daily_token_limit, hard_daily_token_limit, hourly_message_limit_per_ip, hourly_message_limit_per_tenant, max_input_chars
		 FROM abuse_policies
		 WHERE tenant_id = $1`,
		[uuid]
	);

	const row = res.rows[0];
	if (!row) {
		return {
			hardDailyTokenLimit: 120000,
			hourlyMessageLimitPerIp: 60,
			hourlyMessageLimitPerTenant: 600,
			maxInputChars: 2000,
			softDailyTokenLimit: 80000,
		};
	}

	return {
		hardDailyTokenLimit: row.soft_daily_token_limit,
		hourlyMessageLimitPerIp: row.hourly_message_limit_per_ip,
		hourlyMessageLimitPerTenant: row.hourly_message_limit_per_tenant,
		maxInputChars: row.max_input_chars,
		softDailyTokenLimit: row.soft_daily_token_limit,
	};
}

export async function upsertAbusePolicy(tenantId: string, policy: any) {
	const uuid = getTenantUuid(tenantId);
	await ensureTenant(tenantId);

	await query(
		`INSERT INTO abuse_policies (tenant_id, soft_daily_token_limit, hard_daily_token_limit, hourly_message_limit_per_ip, hourly_message_limit_per_tenant, max_input_chars, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())
		 ON CONFLICT (tenant_id) DO UPDATE SET
			soft_daily_token_limit = EXCLUDED.soft_daily_token_limit,
			hard_daily_token_limit = EXCLUDED.hard_daily_token_limit,
			hourly_message_limit_per_ip = EXCLUDED.hourly_message_limit_per_ip,
			hourly_message_limit_per_tenant = EXCLUDED.hourly_message_limit_per_tenant,
			max_input_chars = EXCLUDED.max_input_chars,
			updated_at = NOW()`,
		[
			uuid,
			policy.softDailyTokenLimit,
			policy.hardDailyTokenLimit,
			policy.hourlyMessageLimitPerIp,
			policy.hourlyMessageLimitPerTenant,
			policy.maxInputChars,
		]
	);
}

export async function listKnowledgeDocuments(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	const res = await query(
		`SELECT id, file_name, content_type, size_bytes, ingestion_status, created_at
		 FROM knowledge_documents
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		[uuid]
	);

	return res.rows.map(row => ({
		id: row.id,
		contentType: row.content_type,
		fileName: row.file_name,
		ingestionStatus: row.ingestion_status,
		sizeBytes: row.size_bytes,
		uploadedAt: row.created_at.toISOString(),
	}));
}

export async function insertKnowledgeDocument(tenantId: string, doc: any) {
	const uuid = getTenantUuid(tenantId);
	const docId = crypto.randomUUID();

	await query(
		`INSERT INTO knowledge_documents (id, tenant_id, file_name, content_type, size_bytes, ingestion_status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		[
			docId,
			uuid,
			doc.fileName,
			doc.contentType,
			doc.sizeBytes,
			doc.ingestionStatus || 'queued',
		]
	);

	return {
		id: docId,
		contentType: doc.contentType,
		fileName: doc.fileName,
		ingestionStatus: doc.ingestionStatus || 'queued',
		sizeBytes: doc.sizeBytes,
		uploadedAt: new Date().toISOString(),
	};
}

export async function listChatSessions(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	const res = await query(
		`SELECT s.id, s.channel, s.created_at, COUNT(m.id) as message_count
		 FROM chat_sessions s
		 LEFT JOIN chat_messages m ON s.id = m.session_id
		 WHERE s.tenant_id = $1
		 GROUP BY s.id
		 ORDER BY s.created_at DESC`,
		[uuid]
	);

	return res.rows.map(row => ({
		id: row.id,
		channel: row.channel,
		createdAt: row.created_at.toISOString(),
		messageCount: parseInt(row.message_count, 10),
	}));
}

export async function getChatMessages(sessionId: string) {
	const res = await query(
		`SELECT role, content, created_at
		 FROM chat_messages
		 WHERE session_id = $1
		 ORDER BY created_at ASC`,
		[sessionId]
	);

	return res.rows.map(row => ({
		role: row.role,
		content: row.content,
		createdAt: row.created_at.toISOString(),
	}));
}

export async function createChatSession(tenantId: string, channel = 'widget'): Promise<string> {
	const uuid = getTenantUuid(tenantId);
	const sessionId = crypto.randomUUID();

	await query(
		`INSERT INTO chat_sessions (id, tenant_id, channel, created_at)
		 VALUES ($1, $2, $3, NOW())`,
		[sessionId, uuid, channel]
	);

	return sessionId;
}

export async function insertChatMessage(sessionId: string, role: string, content: string): Promise<string> {
	const messageId = crypto.randomUUID();

	await query(
		`INSERT INTO chat_messages (id, session_id, role, content, created_at)
		 VALUES ($1, $2, $3, $4, NOW())`,
		[messageId, sessionId, role, content]
	);

	return messageId;
}

export async function clearProducts(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	await query(`DELETE FROM products WHERE tenant_id = $1`, [uuid]);
}

export async function insertProduct(tenantId: string, product: { externalId: string; title: string; description: string; metadata?: any }) {
	const uuid = getTenantUuid(tenantId);
	const productId = crypto.randomUUID();

	await query(
		`INSERT INTO products (id, tenant_id, external_id, title, description, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		 ON CONFLICT (tenant_id, external_id) DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			metadata = EXCLUDED.metadata,
			updated_at = NOW()`,
		[
			productId,
			uuid,
			product.externalId,
			product.title,
			product.description,
			JSON.stringify(product.metadata || {}),
		]
	);

	// Get actual product ID (in case of update, retrieve the existing one)
	const res = await query(
		`SELECT id FROM products WHERE tenant_id = $1 AND external_id = $2`,
		[uuid, product.externalId]
	);
	return res.rows[0].id;
}

export async function insertProductEmbedding(tenantId: string, productId: string, chunkText: string, embedding: number[]) {
	const uuid = getTenantUuid(tenantId);
	const embeddingId = crypto.randomUUID();

	// Convert number array to vector string '[0.1, 0.2, ...]'
	const vectorStr = `[${embedding.join(',')}]`;

	await query(
		`INSERT INTO product_embeddings (id, tenant_id, product_id, chunk_text, embedding, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		[embeddingId, uuid, productId, chunkText, vectorStr]
	);
}

export async function deleteProductEmbeddingsByProductId(productId: string) {
	await query(`DELETE FROM product_embeddings WHERE product_id = $1`, [productId]);
}

export async function clearAllMemory(tenantId: string) {
	const uuid = getTenantUuid(tenantId);
	// product_embeddings has ON DELETE CASCADE from products, so deleting products
	// will automatically delete their embeddings.
	// But we also need to clear standalone knowledge chunks (external_id prefix 'doc:').
	await query(`DELETE FROM products WHERE tenant_id = $1`, [uuid]);
}

export async function insertKnowledgeChunk(
	tenantId: string,
	sourceName: string,
	chunkText: string,
	embedding: number[]
) {
	const uuid = getTenantUuid(tenantId);
	const externalId = `doc:${crypto.randomUUID()}`;
	const productId = crypto.randomUUID();

	// Store document chunks as pseudo-products for unified RAG retrieval
	await query(
		`INSERT INTO products (id, tenant_id, external_id, title, description, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
		[
			productId,
			uuid,
			externalId,
			sourceName,
			chunkText,
			JSON.stringify({ source_type: 'document', source_name: sourceName }),
		]
	);

	const vectorStr = `[${embedding.join(',')}]`;
	const embeddingId = crypto.randomUUID();
	await query(
		`INSERT INTO product_embeddings (id, tenant_id, product_id, chunk_text, embedding, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		[embeddingId, uuid, productId, chunkText, vectorStr]
	);

	return productId;
}

export async function searchProductEmbeddings(tenantId: string, queryEmbedding: number[], limit = 5) {
	const uuid = getTenantUuid(tenantId);
	const vectorStr = `[${queryEmbedding.join(',')}]`;

	// Using cosine similarity: 1 - (embedding <=> queryEmbedding)
	// '<=>' operator is cosine distance, so smaller distance means higher similarity.
	const res = await query(
		`SELECT pe.chunk_text, p.title, p.description, p.metadata, 
		        (1 - (pe.embedding <=> $2::vector)) as similarity
		 FROM product_embeddings pe
		 JOIN products p ON pe.product_id = p.id
		 WHERE pe.tenant_id = $1
		 ORDER BY pe.embedding <=> $2::vector ASC
		 LIMIT $3`,
		[uuid, vectorStr, limit]
	);

	return res.rows.map(row => ({
		chunkText: row.chunk_text,
		description: row.description,
		metadata: row.metadata,
		similarity: parseFloat(row.similarity),
		title: row.title,
	}));
}

function parseIngestionJobRow(row: any): IngestionJobRecord {
	return {
		id: row.id,
		status: row.status,
		sourceType: row.source_type,
		stats: row.stats || {},
		createdAt: row.created_at.toISOString(),
		updatedAt: row.updated_at.toISOString(),
	};
}

export async function createIngestionJob(
	tenantId: string,
	sourceType: string,
	stats: IngestionJobStats = {}
): Promise<IngestionJobRecord> {
	const uuid = getTenantUuid(tenantId);
	await ensureTenant(tenantId);
	const jobId = crypto.randomUUID();

	const res = await query(
		`INSERT INTO ingestion_jobs (id, tenant_id, source_type, status, stats, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		 RETURNING id, source_type, status, stats, created_at, updated_at`,
		[jobId, uuid, sourceType, 'queued', JSON.stringify(stats)]
	);

	return parseIngestionJobRow(res.rows[0]);
}

export async function getIngestionJob(tenantId: string, jobId: string): Promise<IngestionJobRecord | null> {
	const uuid = getTenantUuid(tenantId);
	const res = await query(
		`SELECT id, source_type, status, stats, created_at, updated_at
		 FROM ingestion_jobs
		 WHERE tenant_id = $1 AND id = $2`,
		[uuid, jobId]
	);

	if (res.rows.length === 0) {
		return null;
	}

	return parseIngestionJobRow(res.rows[0]);
}

export async function updateIngestionJob(
	tenantId: string,
	jobId: string,
	status: IngestionJobStatus,
	statsPatch: IngestionJobStats
): Promise<IngestionJobRecord | null> {
	const uuid = getTenantUuid(tenantId);
	const existing = await getIngestionJob(tenantId, jobId);

	if (!existing) {
		return null;
	}

	const mergedStats = {
		...existing.stats,
		...statsPatch,
	};

	const res = await query(
		`UPDATE ingestion_jobs
		 SET status = $3,
		     stats = $4,
		     updated_at = NOW()
		 WHERE tenant_id = $1 AND id = $2
		 RETURNING id, source_type, status, stats, created_at, updated_at`,
		[uuid, jobId, status, JSON.stringify(mergedStats)]
	);

	if (res.rows.length === 0) {
		return null;
	}

	return parseIngestionJobRow(res.rows[0]);
}
