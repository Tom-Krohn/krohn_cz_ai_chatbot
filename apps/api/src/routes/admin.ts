import { Hono } from 'hono';

import {
	abusePolicySchema,
	adminSettingsSchema,
	chatPreviewRequestSchema,
	knowledgeDocumentSchema,
} from '@chat-agent/shared';

import { runChatTurn } from '@chat-agent/ai-core';
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
} from '../lib/db-repository.js';
import { syncFeed } from '../lib/feed-sync.js';

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
	const preview = await runChatTurn({
		message: parsed.data.message,
		tenantId,
	}, undefined, settings?.llm);

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

	const result = await syncFeed(tenantId, settings.connector.productFeedUrl);
	return context.json(result, result.success ? 200 : 500);
});
