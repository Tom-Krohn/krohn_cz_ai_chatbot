import { Hono } from 'hono';

import { addToCart } from '@chat-agent/integrations';
import { checkoutLeadSchema } from '@chat-agent/shared';

export const commerceRoute = new Hono();

commerceRoute.post('/add-to-cart', async (context) => {
	const payload = await context.req.json();
	const result = await addToCart({
		platform: payload.platform,
		productId: String(payload.productId ?? ''),
		quantity: Number(payload.quantity ?? 1),
	});

	return context.json(result, result.success ? 200 : 400);
});

commerceRoute.post('/checkout/lead', async (context) => {
	const payload = await context.req.json();
	const lead = checkoutLeadSchema.safeParse(payload);

	if (!lead.success) {
		return context.json(
			{
				error: {
					code: 'invalid_lead_data',
					message: 'Please provide valid name, email, and address fields.',
				},
			},
			400,
		);
	}

	return context.json({
		status: 'validated',
		lead: lead.data,
	});
});
