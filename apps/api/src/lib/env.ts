import { z } from 'zod';

const envSchema = z.object({
	API_PORT: z.coerce.number().int().positive().default(8787),
	JWT_SECRET: z.string().min(12),
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	OPENAI_API_KEY: z.string().min(1).optional(),
	RETELL_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export const envConfig = envSchema.parse(process.env);
