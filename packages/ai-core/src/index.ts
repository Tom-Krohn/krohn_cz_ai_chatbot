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

function getLlmModel() {
	const openaiKey = process.env.OPENAI_API_KEY;
	const geminiKey = process.env.GEMINI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;

	if (geminiKey && geminiKey !== 'mock-gemini-key-value-for-testing') {
		const google = createGoogleGenerativeAI({ apiKey: geminiKey });
		return google('gemini-1.5-flash');
	}

	if (anthropicKey && anthropicKey !== 'mock-anthropic-key-value-for-testing') {
		const anthropic = createAnthropic({ apiKey: anthropicKey });
		return anthropic('claude-3-5-sonnet-20240620');
	}

	// Default to OpenAI
	const openai = createOpenAI({
		apiKey: openaiKey || 'mock-openai-key-value-for-testing',
	});
	return openai('gpt-4o-mini');
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
	productsContext?: ProductContextItem[]
): Promise<{ message: string }> {
	const validatedInput = chatTurnInputSchema.parse(input);
	const model = getLlmModel();

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
