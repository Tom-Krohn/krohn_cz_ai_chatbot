import { z } from 'zod';

export const chatTurnInputSchema = z.object({
	message: z.string().min(1),
	tenantId: z.string().min(1),
});

export const checkoutLeadSchema = z.object({
	addressLine1: z.string().min(1),
	city: z.string().min(1),
	email: z.string().email(),
	fullName: z.string().min(2),
	postalCode: z.string().min(2),
});

export const connectorSettingsSchema = z.object({
	platform: z.enum(['prestashop', 'shoptet', 'woocommerce', 'shopify', 'custom-feed']),
	prestashopApiKeyAlias: z.string().min(3).optional(),
	productApiUrl: z.string().url().optional(),
	productFeedUrl: z.string().url().optional(),
	shoptetPremium: z.boolean().default(false),
});

export const llmSettingsSchema = z.object({
	apiKeyAlias: z.string().min(3),
	model: z.string().min(2),
	provider: z.enum(['openai', 'gemini', 'claude']),
});

export const adminSettingsSchema = z.object({
	abuseProtectionEnabled: z.boolean().default(true),
	connector: connectorSettingsSchema,
	llm: llmSettingsSchema,
});

export const knowledgeDocumentSchema = z.object({
	contentType: z.enum(['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
	fileName: z.string().min(3),
	sizeBytes: z.number().int().positive().max(20_000_000),
});

export const chatPreviewRequestSchema = z.object({
	message: z.string().min(1).max(2000),
});

export const abusePolicySchema = z.object({
	hardDailyTokenLimit: z.number().int().positive(),
	hourlyMessageLimitPerIp: z.number().int().positive(),
	hourlyMessageLimitPerTenant: z.number().int().positive(),
	maxInputChars: z.number().int().positive(),
	softDailyTokenLimit: z.number().int().positive(),
});

export type ChatTurnInput = z.infer<typeof chatTurnInputSchema>;
export type CheckoutLead = z.infer<typeof checkoutLeadSchema>;
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
export type ChatPreviewRequest = z.infer<typeof chatPreviewRequestSchema>;
export type AbusePolicy = z.infer<typeof abusePolicySchema>;
