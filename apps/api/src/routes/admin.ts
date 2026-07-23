import { Hono } from 'hono';

import {
	abusePolicySchema,
	adminSettingsSchema,
	chatPreviewRequestSchema,
	knowledgeDocumentSchema,
} from '@chat-agent/shared';

import { runChatTurn } from '@chat-agent/ai-core';
import { generateEmbedding } from '@chat-agent/ai-core';
import type { AppVariables } from '../types/hono-context.js';
import {
	getTenantSettings,
	upsertTenantSettings,
	listKnowledgeDocuments,
	insertKnowledgeDocument,
	getAbusePolicy,
	upsertAbusePolicy,
	listChatSessions,
	getChatMessages,
	clearAllMemory,
	insertKnowledgeChunk,
	createIngestionJob,
	getIngestionJob,
	updateIngestionJob,
	searchProductEmbeddings,
} from '../lib/db-repository.js';
import { syncFeed, chunkText } from '../lib/feed-sync.js';

function readTenantId(context: { get: (name: string) => unknown }): string {
	return String(context.get('tenantId'));
}

export const adminRoute = new Hono<{ Variables: AppVariables }>();

adminRoute.get('/settings', async (context) => {
	const tenantId = readTenantId(context);
	const stored = await getTenantSettings(tenantId);
	return context.json({ settings: stored });
});

adminRoute.put('/settings', async (context) => {
	const payload = await context.req.json();
	const parsed = adminSettingsSchema.safeParse(payload);

	if (!parsed.success) {
		return context.json(
			{
				error: {
					code: 'invalid_admin_settings',
					message: 'Invalid admin settings payload.',
					details: parsed.error.issues.map((issue) => ({
						message: issue.message,
						path: issue.path.join('.'),
					})),
				},
			},
			400,
		);
	}

	const tenantId = readTenantId(context);
	await upsertTenantSettings(tenantId, parsed.data);
	return context.json({ saved: true, settings: parsed.data });
});

adminRoute.get('/documents', async (context) => {
	const tenantId = readTenantId(context);
	const documents = await listKnowledgeDocuments(tenantId);
	return context.json({ documents });
});

adminRoute.post('/documents', async (context) => {
	const payload = await context.req.json();
	const parsed = knowledgeDocumentSchema.safeParse(payload);

	if (!parsed.success) {
		return context.json(
			{
				error: {
					code: 'invalid_document_metadata',
					message: 'Invalid document metadata.',
				},
			},
			400,
		);
	}

	const tenantId = readTenantId(context);
	const doc = await insertKnowledgeDocument(tenantId, parsed.data);
	return context.json({ document: doc, queuedForIngestion: true }, 201);
});

adminRoute.get('/abuse-policy', async (context) => {
	const tenantId = readTenantId(context);
	const policy = await getAbusePolicy(tenantId);
	return context.json({ policy });
});

adminRoute.put('/abuse-policy', async (context) => {
	const payload = await context.req.json();
	const parsed = abusePolicySchema.safeParse(payload);

	if (!parsed.success) {
		return context.json(
			{
				error: {
					code: 'invalid_abuse_policy',
					message: 'Invalid abuse policy payload.',
				},
			},
			400,
		);
	}

	const tenantId = readTenantId(context);
	await upsertAbusePolicy(tenantId, parsed.data);
	return context.json({ saved: true, policy: parsed.data });
});

adminRoute.post('/chat-preview', async (context) => {
	const payload = await context.req.json();
	const parsed = chatPreviewRequestSchema.safeParse(payload);

	if (!parsed.success) {
		return context.json(
			{
				error: {
					code: 'invalid_preview_payload',
					message: 'Missing or invalid preview message.',
				},
			},
			400,
		);
	}

	const tenantId = readTenantId(context);
	const settings = await getTenantSettings(tenantId);

	let productsContext: any[] = [];
	try {
		const queryEmbedding = await generateEmbedding(parsed.data.message);
		productsContext = await searchProductEmbeddings(tenantId, queryEmbedding, 5);
	} catch (err: any) {
		console.error('Failed semantic search context retrieval in preview:', err.message);
	}

	const preview = await runChatTurn({
		message: parsed.data.message,
		tenantId,
	}, productsContext, settings?.llm);

	return context.json({
		preview,
		sandboxMode: true,
	});
});

// Conversations log history
adminRoute.get('/sessions', async (context) => {
	const tenantId = readTenantId(context);
	const sessions = await listChatSessions(tenantId);
	return context.json({ sessions });
});

adminRoute.get('/sessions/:id/messages', async (context) => {
	const sessionId = context.req.param('id');
	const messages = await getChatMessages(sessionId);
	return context.json({ messages });
});

// Product feed synchronization trigger
adminRoute.post('/connector/sync', async (context) => {
	const tenantId = readTenantId(context);
	const settings = await getTenantSettings(tenantId);

	if (!settings?.connector?.productFeedUrl) {
		return context.json(
			{
				error: {
					code: 'missing_feed_url',
					message: 'Product feed URL is not configured. Please save it in Connector Settings first.',
				},
			},
			400,
		);
	}

	const syncJob = await createIngestionJob(tenantId, 'product_feed', {
		failed: 0,
		percent: 0,
		processed: 0,
		total: 0,
		totalEmbedded: 0,
		totalParsed: 0,
		totalUpdated: 0,
	});

	void (async () => {
		try {
			await updateIngestionJob(tenantId, syncJob.id, 'running', {
				startedAt: new Date().toISOString(),
			});

			const result = await syncFeed(tenantId, settings.connector.productFeedUrl, {
				onProgress: async (progress) => {
					await updateIngestionJob(tenantId, syncJob.id, 'running', {
						failed: progress.failed,
						percent: progress.percent,
						processed: progress.processed,
						total: progress.total,
						totalEmbedded: progress.totalEmbedded,
						totalParsed: progress.totalParsed,
						totalUpdated: progress.totalUpdated,
					});
				},
			});

			if (result.success) {
				await updateIngestionJob(tenantId, syncJob.id, 'done', {
					failed: result.stats?.failed ?? 0,
					finishedAt: new Date().toISOString(),
					percent: 100,
					processed: result.stats?.totalParsed ?? 0,
					total: result.stats?.totalParsed ?? 0,
					totalEmbedded: result.stats?.totalEmbedded ?? 0,
					totalParsed: result.stats?.totalParsed ?? 0,
					totalUpdated: result.stats?.totalUpdated ?? 0,
				});
				return;
			}

			await updateIngestionJob(tenantId, syncJob.id, 'failed', {
				errorMessage: result.message,
				finishedAt: new Date().toISOString(),
			});
		} catch (error: any) {
			console.error('Background feed sync failed:', error);
			await updateIngestionJob(tenantId, syncJob.id, 'failed', {
				errorMessage: `Synchronization failed: ${error.message}`,
				finishedAt: new Date().toISOString(),
			});
		}
	})();

	return context.json({
		success: true,
		message: 'Synchronizace spuštěna.',
		syncJobId: syncJob.id,
		status: syncJob.status,
		stats: syncJob.stats,
		createdAt: syncJob.createdAt,
		updatedAt: syncJob.updatedAt,
	}, 202);
});

adminRoute.get('/connector/sync/:jobId', async (context) => {
	const tenantId = readTenantId(context);
	const jobId = context.req.param('jobId');
	const job = await getIngestionJob(tenantId, jobId);

	if (!job) {
		return context.json(
			{
				error: {
					code: 'sync_job_not_found',
					message: 'Synchronizační job nebyl nalezen.',
				},
			},
			404,
		);
	}

	const stats = job.stats || {};
	const total = Number(stats.total || 0);
	const processed = Number(stats.processed || 0);
	const percent = total > 0
		? Math.max(0, Math.min(100, Math.floor((processed / total) * 100)))
		: (job.status === 'done' ? 100 : 0);

	const message = job.status === 'done'
		? `Synchronizace dokončena. Zpracováno ${stats.totalEmbedded || 0} produktů.`
		: job.status === 'failed'
			? String(stats.errorMessage || 'Synchronizace selhala.')
			: 'Synchronizace probíhá.';

	return context.json({
		syncJobId: job.id,
		status: job.status,
		message,
		stats: {
			...stats,
			percent,
			processed,
			total,
		},
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
	});
});

// RAG memory management: delete entire memory for this tenant
adminRoute.delete('/memory', async (context) => {
	const tenantId = readTenantId(context);
	try {
		await clearAllMemory(tenantId);
		return context.json({ success: true, message: 'Veškerá paměť RAG byla smazána.' });
	} catch (err: any) {
		return context.json({ success: false, message: err.message }, 500);
	}
});

// Knowledge ingestion: plain text or textarea input
adminRoute.post('/knowledge/text', async (context) => {
	const tenantId = readTenantId(context);
	let payload: { text?: string; sourceName?: string };
	try {
		payload = await context.req.json();
	} catch {
		return context.json({ error: { code: 'invalid_body', message: 'Expected JSON body.' } }, 400);
	}

	const text = typeof payload.text === 'string' ? payload.text.trim() : '';
	const sourceName = typeof payload.sourceName === 'string' && payload.sourceName.trim()
		? payload.sourceName.trim()
		: 'Ruční zápis';

	if (text.length < 10) {
		return context.json({ error: { code: 'text_too_short', message: 'Text musí mít alespoň 10 znaků.' } }, 400);
	}

	const chunks = chunkText(text);
	const savedChunks: string[] = [];

	for (const chunk of chunks) {
		try {
			const embedding = await generateEmbedding(chunk);
			await insertKnowledgeChunk(tenantId, sourceName, chunk, embedding);
			savedChunks.push(chunk.slice(0, 60));
		} catch (err: any) {
			console.error('Failed to embed knowledge chunk:', err.message);
		}
	}

	return context.json({
		success: true,
		message: `Uloženo ${savedChunks.length} z ${chunks.length} fragmentů do paměti RAG.`,
		chunksTotal: chunks.length,
		chunksSaved: savedChunks.length,
	});
});

// Knowledge ingestion: file upload (TXT, MD, CSV)
adminRoute.post('/knowledge/file', async (context) => {
	const tenantId = readTenantId(context);

	let body: FormData;
	try {
		body = await context.req.formData();
	} catch {
		return context.json({ error: { code: 'invalid_form', message: 'Expected multipart/form-data.' } }, 400);
	}

	const file = body.get('file');
	const sourceName = String(body.get('sourceName') || '');

	if (!(file instanceof File)) {
		return context.json({ error: { code: 'missing_file', message: 'Soubor nebyl nahrán.' } }, 400);
	}

	const allowed = ['text/plain', 'text/markdown', 'text/csv', 'application/csv', 'text/x-csv'];
	const ext = file.name.split('.').pop()?.toLowerCase();
	const isAllowedExt = ['txt', 'md', 'csv', 'markdown'].includes(ext ?? '');

	if (!allowed.includes(file.type) && !isAllowedExt) {
		return context.json({
			error: {
				code: 'unsupported_file_type',
				message: `Nepodporovaný formát souboru. Povolené: TXT, MD, CSV. Nahraný typ: ${file.type || ext}`,
			},
		}, 400);
	}

	const text = await file.text();
	if (text.trim().length < 10) {
		return context.json({ error: { code: 'empty_file', message: 'Soubor je prázdný nebo příliš krátký.' } }, 400);
	}

	const name = sourceName.trim() || file.name;
	const chunks = chunkText(text);
	let chunksSaved = 0;

	for (const chunk of chunks) {
		try {
			const embedding = await generateEmbedding(chunk);
			await insertKnowledgeChunk(tenantId, name, chunk, embedding);
			chunksSaved++;
		} catch (err: any) {
			console.error('Failed to embed file chunk:', err.message);
		}
	}

	return context.json({
		success: true,
		message: `Soubor „${name}“ uložen. Zpracováno ${chunksSaved} z ${chunks.length} fragmentů.`,
		chunksTotal: chunks.length,
		chunksSaved,
	});
});
