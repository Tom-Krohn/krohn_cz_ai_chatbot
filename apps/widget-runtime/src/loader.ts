import { detectPlatform } from '@chat-agent/integrations';

type WidgetOptions = {
	apiBaseUrl?: string;
	brandName?: string;
	tenantId: string;
};

type ChatResponse = {
	message: string;
};

const DEFAULT_API_BASE = 'http://localhost:8787';

function createStyles(): string {
	return `
		:host {
			all: initial;
		}
		.wrapper {
			bottom: 24px;
			font-family: ui-sans-serif, system-ui, sans-serif;
			position: fixed;
			right: 24px;
			z-index: 2147483646;
		}
		.bubble {
			background: #163d2a;
			border: 0;
			border-radius: 9999px;
			color: #ffffff;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			padding: 12px 16px;
		}
		.panel {
			background: #fefaf3;
			border: 1px solid #d9d1c2;
			border-radius: 16px;
			bottom: 56px;
			display: none;
			height: 420px;
			overflow: hidden;
			position: absolute;
			right: 0;
			width: 320px;
		}
		.panel.open {
			display: flex;
			flex-direction: column;
		}
		.header {
			align-items: center;
			background: #ffffff;
			border-bottom: 1px solid #ebe4d7;
			display: flex;
			font-size: 12px;
			gap: 8px;
			justify-content: space-between;
			padding: 10px 12px;
		}
		.log {
			flex: 1;
			overflow-y: auto;
			padding: 12px;
		}
		.row {
			margin-bottom: 10px;
		}
		.row.bot {
			color: #1f2937;
		}
		.row.user {
			color: #0f766e;
			text-align: right;
		}
		.form {
			border-top: 1px solid #ebe4d7;
			display: flex;
			gap: 8px;
			padding: 10px;
		}
		.input {
			border: 1px solid #c9c1b2;
			border-radius: 10px;
			flex: 1;
			font-size: 13px;
			padding: 8px;
		}
		.send {
			background: #163d2a;
			border: 0;
			border-radius: 10px;
			color: #ffffff;
			cursor: pointer;
			font-weight: 600;
			padding: 8px 12px;
		}
	`;
}

function appendMessage(logElement: HTMLElement, role: 'bot' | 'user', value: string): void {
	const rowElement = document.createElement('div');
	rowElement.className = `row ${role}`;
	rowElement.textContent = value;
	logElement.appendChild(rowElement);
	logElement.scrollTop = logElement.scrollHeight;
}

async function sendChatMessage(
	apiBaseUrl: string,
	tenantId: string,
	message: string,
): Promise<ChatResponse> {
	const response = await fetch(`${apiBaseUrl}/api/chat`, {
		body: JSON.stringify({ message }),
		headers: {
			'content-type': 'application/json',
			'x-tenant-id': tenantId,
		},
		method: 'POST',
	});

	if (!response.ok) {
		return { message: 'Omlouvam se, sluzba je docasne nedostupna.' };
	}

	const data = (await response.json()) as ChatResponse;
	return data;
}

export function mountWidget(options: WidgetOptions): void {
	const hostElement = document.createElement('div');
	const shadowRoot = hostElement.attachShadow({ mode: 'closed' });
	const platform = detectPlatform(window);

	hostElement.setAttribute('data-chat-agent', platform);
	document.body.appendChild(hostElement);

	const wrapperElement = document.createElement('div');
	wrapperElement.className = 'wrapper';
	const panelElement = document.createElement('section');
	panelElement.className = 'panel';
	const bubbleElement = document.createElement('button');
	bubbleElement.className = 'bubble';
	bubbleElement.textContent = options.brandName ?? 'Poradce';
	bubbleElement.type = 'button';

	const headerElement = document.createElement('div');
	headerElement.className = 'header';
	headerElement.textContent = `AI shopping agent (${platform})`;

	const logElement = document.createElement('div');
	logElement.className = 'log';
	appendMessage(logElement, 'bot', 'Ahoj, s cim vam pomoci s vyberem produktu?');

	const formElement = document.createElement('form');
	formElement.className = 'form';
	const inputElement = document.createElement('input');
	inputElement.className = 'input';
	inputElement.placeholder = 'Napis svoji otazku...';
	const sendElement = document.createElement('button');
	sendElement.className = 'send';
	sendElement.textContent = 'Poslat';
	sendElement.type = 'submit';

	formElement.append(inputElement, sendElement);
	panelElement.append(headerElement, logElement, formElement);
	wrapperElement.append(panelElement, bubbleElement);

	const styleElement = document.createElement('style');
	styleElement.textContent = createStyles();
	shadowRoot.append(styleElement, wrapperElement);

	bubbleElement.addEventListener('click', () => {
		panelElement.classList.toggle('open');
	});

	formElement.addEventListener('submit', async (event) => {
		event.preventDefault();
		const message = inputElement.value.trim();

		if (!message) {
			return;
		}

		appendMessage(logElement, 'user', message);
		inputElement.value = '';

		const response = await sendChatMessage(
			options.apiBaseUrl ?? DEFAULT_API_BASE,
			options.tenantId,
			message,
		);

		appendMessage(logElement, 'bot', response.message);
	});
}
