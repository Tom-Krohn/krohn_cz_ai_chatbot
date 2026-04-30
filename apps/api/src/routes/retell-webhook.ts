import { Hono } from 'hono';

export const retellWebhookRoute = new Hono();

retellWebhookRoute.post('/', async (context) => {
	const eventPayload = await context.req.json();

	return context.json({
		acknowledged: true,
		eventType: eventPayload?.event,
	});
});
