import { createMiddleware } from 'hono/factory';

export type TenantAuthContext = {
	tenantId: string;
};

export const tenantAuthMiddleware = createMiddleware(async (context, next) => {
	const tenantHeader = context.req.header('x-tenant-id');

	if (!tenantHeader) {
		return context.json(
			{
				error: {
					code: 'missing_tenant',
					message: 'Missing x-tenant-id header',
				},
			},
			400,
		);
	}

	context.set('tenantId', tenantHeader);
	await next();
});
