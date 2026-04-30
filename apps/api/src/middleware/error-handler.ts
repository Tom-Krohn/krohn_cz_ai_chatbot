import type { Context, Next } from 'hono';

export async function errorHandler(context: Context, next: Next): Promise<void> {
	try {
		await next();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		context.status(500);
		context.json({
			error: {
				code: 'internal_error',
				message,
			},
		});
	}
}
