import { Hono } from 'hono';

import { runChatTurn, generateEmbedding } from '@chat-agent/ai-core';
import type { AppVariables } from '../types/hono-context.js';
import {
	createChatSession,
	insertChatMessage,
	getTenantSettings,
	searchProductEmbeddings,
} from '../lib/db-repository.js';

export const chatRoute = new Hono<{ Variables: AppVariables }>();

chatRoute.post('/', async (context) => {
	const payload = await context.req.json();
	const tenantId = String(context.get('tenantId'));
	const message = String(payload.message ?? '').trim();

	if (!message) {
		return context.json({ error: { message: 'Message is required' } }, 400);
	}

	// Resolve or create chat session
	let sessionId = payload.sessionId;
	if (!sessionId || typeof sessionId !== 'string') {
		sessionId = await createChatSession(tenantId, 'widget');
	}

	// Log user message
	await insertChatMessage(sessionId, 'user', message);

	// Retrieve products using semantic search (RAG)
	let productsContext: any[] = [];
	try {
		const queryEmbedding = await generateEmbedding(message);
		productsContext = await searchProductEmbeddings(tenantId, queryEmbedding, 5);
	} catch (err: any) {
		console.error('Failed semantic search context retrieval:', err.message);
	}

	// Run Chat turn with prompt injected products context
	const settings = await getTenantSettings(tenantId);
	const result = await runChatTurn({
		message,
		tenantId,
	}, productsContext, settings?.llm);

	// Log bot response
	await insertChatMessage(sessionId, 'assistant', result.message);

	return context.json({
		message: result.message,
		sessionId,
	}, 200);
});
