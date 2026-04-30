import { Hono } from 'hono';

import {
	abusePolicySchema,
	adminSettingsSchema,
	chatPreviewRequestSchema,
	knowledgeDocumentSchema,
} from '@chat-agent/shared';

import { runChatTurn } from '@chat-agent/ai-core';

const settingsStore = new Map<string, unknown>();
const documentStore = new Map<string, unknown[]>();
const abusePolicyStore = new Map<string, unknown>();

function readTenantId(context: { get: (name: string) => unknown }): string {
	return String(context.get('tenantId'));
}

export const adminRoute = new Hono();

adminRoute.get('/settings', async (context) => {
	const tenantId = readTenantId(context);
	const stored = settingsStore.get(tenantId);

	if (!stored) {
		return context.json({
			settings: {
				abuseProtectionEnabled: true,
				connector: {
					platform: 'prestashop',
					prestashopApiKeyAlias: 'prestashop-main-key',
					shoptetPremium: false,
				},
				llm: {
					apiKeyAlias: 'default-key',
					model: 'gpt-4o-mini',
					provider: 'openai',
				},
			},
		});
	}

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
				},
			},
			400,
		);
	}

	const tenantId = readTenantId(context);
	settingsStore.set(tenantId, parsed.data);
	return context.json({ saved: true, settings: parsed.data });
});

adminRoute.get('/documents', async (context) => {
	const tenantId = readTenantId(context);
	const documents = documentStore.get(tenantId) || [];
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
	const existing = documentStore.get(tenantId) || [];
	const nextDocument = {
		id: `${tenantId}-${existing.length + 1}`,
		uploadedAt: new Date().toISOString(),
		...parsed.data,
	};
	documentStore.set(tenantId, [...existing, nextDocument]);

	return context.json({ document: nextDocument, queuedForIngestion: true }, 201);
});

adminRoute.get('/abuse-policy', async (context) => {
	const tenantId = readTenantId(context);
	const policy = abusePolicyStore.get(tenantId) || {
		hardDailyTokenLimit: 120000,
		hourlyMessageLimitPerIp: 60,
		hourlyMessageLimitPerTenant: 600,
		maxInputChars: 2000,
		softDailyTokenLimit: 80000,
	};

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
	abusePolicyStore.set(tenantId, parsed.data);
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
	const preview = await runChatTurn({
		message: parsed.data.message,
		tenantId,
	});

	return context.json({
		preview,
		sandboxMode: true,
	});
});
