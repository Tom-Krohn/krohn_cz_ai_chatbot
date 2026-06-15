import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, embed } from 'ai';

import { chatTurnInputSchema, type ChatTurnInput } from '@chat-agent/shared';

export type ProductContextItem = {
	title: string;
	description: string;
	metadata?: {
		price?: string;
		url?: string;
		[key: string]: any;
	};
};

export type LlmProvider = 'openai' | 'gemini' | 'claude';

export type LlmRuntimeConfig = {
	provider: LlmProvider;
	model: string;
};

function isConfiguredKey(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	const trimmed = value.trim();
	return trimmed.length > 0
		&& trimmed !== 'mock-openai-key-value-for-testing'
		&& trimmed !== 'mock-gemini-key-value-for-testing'
		&& trimmed !== 'mock-anthropic-key-value-for-testing';
}

function defaultModelForProvider(provider: LlmProvider): string {
	switch (provider) {
		case 'gemini':
			return 'gemini-2.5-flash';
		case 'claude':
			return 'claude-3-5-sonnet-20240620';
		case 'openai':
		default:
			return 'gpt-4o-mini';
	}
}

function normalizeModelId(provider: LlmProvider, model: string | undefined): string {
	const trimmed = model?.trim();
	if (!trimmed) {
		return defaultModelForProvider(provider);
	}

	if (provider === 'gemini' && (trimmed === 'gemini-1.5-flash' || trimmed === 'gemini-1.5-pro')) {
		return defaultModelForProvider('gemini');
	}

	return trimmed;
}

function getLlmModel(config?: LlmRuntimeConfig) {
	const openaiKey = process.env.OPENAI_API_KEY;
	const geminiKey = process.env.GEMINI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;
	const selectedProvider = config?.provider;
	const selectedModel = config?.model?.trim();

	if (selectedProvider) {
		if (selectedProvider === 'gemini') {
			if (!isConfiguredKey(geminiKey)) {
				throw new Error('Gemini API key is not configured in .env (GEMINI_API_KEY).');
			}
			const google = createGoogleGenerativeAI({ apiKey: geminiKey });
			return google(normalizeModelId('gemini', selectedModel));
		}

		if (selectedProvider === 'claude') {
			if (!isConfiguredKey(anthropicKey)) {
				throw new Error('Anthropic API key is not configured in .env (ANTHROPIC_API_KEY).');
			}
			const anthropic = createAnthropic({ apiKey: anthropicKey });
			return anthropic(normalizeModelId('claude', selectedModel));
		}

		if (!isConfiguredKey(openaiKey)) {
			throw new Error('OpenAI API key is not configured in .env (OPENAI_API_KEY).');
		}
		const openai = createOpenAI({ apiKey: openaiKey });
		return openai(normalizeModelId('openai', selectedModel));
	}

	if (isConfiguredKey(geminiKey)) {
		const google = createGoogleGenerativeAI({ apiKey: geminiKey });
		return google(defaultModelForProvider('gemini'));
	}

	if (isConfiguredKey(anthropicKey)) {
		const anthropic = createAnthropic({ apiKey: anthropicKey });
		return anthropic(defaultModelForProvider('claude'));
	}

	if (!isConfiguredKey(openaiKey)) {
		throw new Error('No valid LLM API key found in .env. Configure OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.');
	}

	const openai = createOpenAI({
		apiKey: openaiKey,
	});
	return openai(defaultModelForProvider('openai'));
}

export async function generateEmbedding(text: string): Promise<number[]> {
	const openaiKey = process.env.OPENAI_API_KEY;
	const geminiKey = process.env.GEMINI_API_KEY;

	if (geminiKey && geminiKey !== 'mock-gemini-key-value-for-testing') {
		const google = createGoogleGenerativeAI({ apiKey: geminiKey });
		const { embedding } = await embed({
			model: google.textEmbeddingModel('text-embedding-004') as any,
			value: text,
		});
		return embedding;
	}

	// Default to OpenAI embedding model
	const openai = createOpenAI({
		apiKey: openaiKey || 'mock-openai-key-value-for-testing',
	});
	const { embedding } = await embed({
		model: openai.embedding('text-embedding-3-small') as any,
		value: text,
	});
	return embedding;
}

export async function runChatTurn(
	input: ChatTurnInput,
	productsContext?: ProductContextItem[],
	llmConfig?: LlmRuntimeConfig
): Promise<{ message: string }> {
	const validatedInput = chatTurnInputSchema.parse(input);
	const model = getLlmModel(llmConfig);

	const systemPrompt = `Jste inteligentní nákupní asistent. Vaším úkolem je pomoci zákazníkovi vybrat produkt nebo službu, která vyřeší jeho problém.
U zákaznických dotazů buďte vstřícní, věcní a profesionální. Odpovídejte v českém jazyce.

Zde jsou relevantní produkty/služby z našeho e-shopu, které můžete doporučit (používejte pouze tyto informace):
${productsContext && productsContext.length > 0
	? productsContext.map((p, idx) => `${idx + 1}. ${p.title}
     Popis: ${p.description}
     Cena: ${p.metadata?.price || 'neuvedena'}
     Odkaz: ${p.metadata?.url || 'neuveden'}`).join('\n\n')
	: 'Žádné konkrétní produkty nebyly nalezeny.'}

Pokud doporučujete produkt, vždy uveďte jeho název, cenu a odkaz (pokud jsou k dispozici). Pokud žádný produkt neodpovídá potřebám zákazníka, zeptejte se na doplňující podrobnosti.`;

	const { text } = await generateText({
		model: model as any,
		system: systemPrompt,
		prompt: validatedInput.message,
	});

	return {
		message: text,
	};
}
