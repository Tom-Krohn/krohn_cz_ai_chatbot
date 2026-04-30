import { createMiddleware } from 'hono/factory';

type Counter = {
	count: number;
	windowStartMs: number;
};

const defaultLimits = {
	hourlyMessageLimitPerIp: 60,
	hourlyMessageLimitPerTenant: 600,
	maxInputChars: 2000,
};

const hourMs = 60 * 60 * 1000;
const ipCounters = new Map<string, Counter>();
const tenantCounters = new Map<string, Counter>();

function hitCounter(counterMap: Map<string, Counter>, key: string, nowMs: number): number {
	const current = counterMap.get(key);

	if (!current || nowMs - current.windowStartMs >= hourMs) {
		counterMap.set(key, { count: 1, windowStartMs: nowMs });
		return 1;
	}

	current.count += 1;
	counterMap.set(key, current);
	return current.count;
}

export const abuseProtectionMiddleware = createMiddleware(async (context, next) => {
	const nowMs = Date.now();
	const tenantId = String(context.get('tenantId') ?? 'unknown-tenant');
	const forwardedIp = context.req.header('x-forwarded-for');
	const ipKey = (forwardedIp?.split(',')[0]?.trim() || 'unknown-ip').toLowerCase();
	const pathKey = context.req.path;

	const ipHits = hitCounter(ipCounters, `${ipKey}:${pathKey}`, nowMs);
	if (ipHits > defaultLimits.hourlyMessageLimitPerIp) {
		context.header('Retry-After', '60');
		return context.json(
			{
				error: {
					code: 'rate_limited_ip',
					message: 'Too many requests from this IP. Please retry later.',
				},
			},
			429,
		);
	}

	const tenantHits = hitCounter(tenantCounters, `${tenantId}:${pathKey}`, nowMs);
	if (tenantHits > defaultLimits.hourlyMessageLimitPerTenant) {
		context.header('Retry-After', '120');
		return context.json(
			{
				error: {
					code: 'rate_limited_tenant',
					message: 'Tenant quota exceeded for this hour.',
				},
			},
			429,
		);
	}

	if (context.req.method === 'POST') {
		const contentLength = Number(context.req.header('content-length') || 0);

		if (contentLength > defaultLimits.maxInputChars * 2) {
			return context.json(
				{
					error: {
						code: 'payload_too_large',
						message: 'Request payload is too large.',
					},
				},
				413,
			);
		}
	}

	await next();
});
