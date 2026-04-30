import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';

import { chatTurnInputSchema, type ChatTurnInput } from '@chat-agent/shared';

export async function runChatTurn(input: ChatTurnInput): Promise<{ message: string }> {
	const validatedInput = chatTurnInputSchema.parse(input);
	const openaiKey = process.env.OPENAI_API_KEY;

	if (!openaiKey) {
		return {
			message: 'OpenAI key is missing. Please configure OPENAI_API_KEY.',
		};
	}

	const { text } = await generateText({
		model: openai('gpt-4o-mini'),
		prompt: validatedInput.message,
		tools: {
			searchProducts: tool({
				description: 'Search products by user intent.',
				inputSchema: z.object({
					query: z.string().min(2),
				}),
				execute: async ({ query }) => {
					return {
						products: [
							{
								id: 'stub-1',
								name: `Relevant item for ${query}`,
							},
						],
					};
				},
			}),
		},
	});

	return {
		message: text,
	};
}
