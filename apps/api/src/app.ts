import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { abuseProtectionMiddleware } from './middleware/abuse-protection.js';
import { errorHandler } from './middleware/error-handler.js';
import { tenantAuthMiddleware } from './middleware/tenant-auth.js';
import { adminRoute } from './routes/admin.js';
import { chatRoute } from './routes/chat.js';
import { commerceRoute } from './routes/commerce.js';
import { healthRoute } from './routes/health.js';
import { retellWebhookRoute } from './routes/retell-webhook.js';
import type { AppVariables } from './types/hono-context.js';

export const app = new Hono<{ Variables: AppVariables }>();

app.use('*', errorHandler);
app.use('/api/*', cors());
app.route('/health', healthRoute);
app.route('/retell/webhook', retellWebhookRoute);

app.get('/chat-agent-loader.js', async (context) => {
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const filePath = path.join(process.cwd(), '../widget-runtime/dist/index.global.js');
		const content = await fs.readFile(filePath, 'utf-8');
		context.header('Content-Type', 'application/javascript');
		context.header('Access-Control-Allow-Origin', '*');
		return context.body(content);
	} catch (err) {
		console.error("Failed to serve widget loader:", err);
		return context.text('Widget loader not compiled yet. Please run build.', 404);
	}
});
app.use('/api/chat/*', tenantAuthMiddleware);
app.use('/api/commerce/*', tenantAuthMiddleware);
app.use('/api/admin/*', tenantAuthMiddleware);
app.use('/api/chat/*', abuseProtectionMiddleware);
app.use('/api/admin/chat-preview', abuseProtectionMiddleware);
app.route('/api/chat', chatRoute);
app.route('/api/commerce', commerceRoute);
app.route('/api/admin', adminRoute);
