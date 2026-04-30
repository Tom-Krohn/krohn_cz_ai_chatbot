import { Hono } from 'hono';

import { runChatTurn } from '@chat-agent/ai-core';

export const chatRoute = new Hono();

chatRoute.post('/', async (context) => {
	const payload = await context.req.json();
	const tenantId = String(context.get('tenantId'));

	const result = await runChatTurn({
		message: String(payload.message ?? ''),
		tenantId,
	});

	return context.json(result, 200);
});
