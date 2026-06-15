import { z } from 'zod';
export declare const chatTurnInputSchema: z.ZodObject<{
    message: z.ZodString;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    tenantId: string;
}, {
    message: string;
    tenantId: string;
}>;
export declare const checkoutLeadSchema: z.ZodObject<{
    addressLine1: z.ZodString;
    city: z.ZodString;
    email: z.ZodString;
    fullName: z.ZodString;
    postalCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    addressLine1: string;
    city: string;
    email: string;
    fullName: string;
    postalCode: string;
}, {
    addressLine1: string;
    city: string;
    email: string;
    fullName: string;
    postalCode: string;
}>;
export declare const connectorSettingsSchema: z.ZodObject<{
    platform: z.ZodEnum<["prestashop", "shoptet", "woocommerce", "shopify", "custom-feed"]>;
    prestashopApiKeyAlias: z.ZodOptional<z.ZodString>;
    productApiUrl: z.ZodOptional<z.ZodString>;
    productFeedUrl: z.ZodOptional<z.ZodString>;
    shoptetPremium: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
    shoptetPremium: boolean;
    prestashopApiKeyAlias?: string | undefined;
    productApiUrl?: string | undefined;
    productFeedUrl?: string | undefined;
}, {
    platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
    prestashopApiKeyAlias?: string | undefined;
    productApiUrl?: string | undefined;
    productFeedUrl?: string | undefined;
    shoptetPremium?: boolean | undefined;
}>;
export declare const llmSettingsSchema: z.ZodObject<{
    apiKeyAlias: z.ZodString;
    model: z.ZodString;
    provider: z.ZodEnum<["openai", "gemini", "claude"]>;
}, "strip", z.ZodTypeAny, {
    apiKeyAlias: string;
    model: string;
    provider: "openai" | "gemini" | "claude";
}, {
    apiKeyAlias: string;
    model: string;
    provider: "openai" | "gemini" | "claude";
}>;
export declare const adminSettingsSchema: z.ZodObject<{
    abuseProtectionEnabled: z.ZodDefault<z.ZodBoolean>;
    connector: z.ZodObject<{
        platform: z.ZodEnum<["prestashop", "shoptet", "woocommerce", "shopify", "custom-feed"]>;
        prestashopApiKeyAlias: z.ZodOptional<z.ZodString>;
        productApiUrl: z.ZodOptional<z.ZodString>;
        productFeedUrl: z.ZodOptional<z.ZodString>;
        shoptetPremium: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
        shoptetPremium: boolean;
        prestashopApiKeyAlias?: string | undefined;
        productApiUrl?: string | undefined;
        productFeedUrl?: string | undefined;
    }, {
        platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
        prestashopApiKeyAlias?: string | undefined;
        productApiUrl?: string | undefined;
        productFeedUrl?: string | undefined;
        shoptetPremium?: boolean | undefined;
    }>;
    llm: z.ZodObject<{
        apiKeyAlias: z.ZodString;
        model: z.ZodString;
        provider: z.ZodEnum<["openai", "gemini", "claude"]>;
    }, "strip", z.ZodTypeAny, {
        apiKeyAlias: string;
        model: string;
        provider: "openai" | "gemini" | "claude";
    }, {
        apiKeyAlias: string;
        model: string;
        provider: "openai" | "gemini" | "claude";
    }>;
}, "strip", z.ZodTypeAny, {
    abuseProtectionEnabled: boolean;
    connector: {
        platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
        shoptetPremium: boolean;
        prestashopApiKeyAlias?: string | undefined;
        productApiUrl?: string | undefined;
        productFeedUrl?: string | undefined;
    };
    llm: {
        apiKeyAlias: string;
        model: string;
        provider: "openai" | "gemini" | "claude";
    };
}, {
    connector: {
        platform: "prestashop" | "shoptet" | "woocommerce" | "shopify" | "custom-feed";
        prestashopApiKeyAlias?: string | undefined;
        productApiUrl?: string | undefined;
        productFeedUrl?: string | undefined;
        shoptetPremium?: boolean | undefined;
    };
    llm: {
        apiKeyAlias: string;
        model: string;
        provider: "openai" | "gemini" | "claude";
    };
    abuseProtectionEnabled?: boolean | undefined;
}>;
export declare const knowledgeDocumentSchema: z.ZodObject<{
    contentType: z.ZodEnum<["text/plain", "text/markdown", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]>;
    fileName: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    contentType: "text/plain" | "text/markdown" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    fileName: string;
    sizeBytes: number;
}, {
    contentType: "text/plain" | "text/markdown" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    fileName: string;
    sizeBytes: number;
}>;
export declare const chatPreviewRequestSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
export declare const abusePolicySchema: z.ZodObject<{
    hardDailyTokenLimit: z.ZodNumber;
    hourlyMessageLimitPerIp: z.ZodNumber;
    hourlyMessageLimitPerTenant: z.ZodNumber;
    maxInputChars: z.ZodNumber;
    softDailyTokenLimit: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hardDailyTokenLimit: number;
    hourlyMessageLimitPerIp: number;
    hourlyMessageLimitPerTenant: number;
    maxInputChars: number;
    softDailyTokenLimit: number;
}, {
    hardDailyTokenLimit: number;
    hourlyMessageLimitPerIp: number;
    hourlyMessageLimitPerTenant: number;
    maxInputChars: number;
    softDailyTokenLimit: number;
}>;
export type ChatTurnInput = z.infer<typeof chatTurnInputSchema>;
export type CheckoutLead = z.infer<typeof checkoutLeadSchema>;
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
export type ChatPreviewRequest = z.infer<typeof chatPreviewRequestSchema>;
export type AbusePolicy = z.infer<typeof abusePolicySchema>;
//# sourceMappingURL=schemas.d.ts.map