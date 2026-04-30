import { mountWidget } from './loader.js';

declare global {
	interface Window {
		ChatAgentWidget?: {
			mount: typeof mountWidget;
		};
	}
}

window.ChatAgentWidget = {
	mount: mountWidget,
};
