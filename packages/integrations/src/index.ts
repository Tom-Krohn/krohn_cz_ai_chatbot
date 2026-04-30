export type PlatformKind = 'prestashop' | 'shoptet' | 'woocommerce' | 'shopify' | 'unknown';

export * from './commerce.js';

export function detectPlatform(hostWindow: Window): PlatformKind {
	const maybePrestashop = (hostWindow as Window & { prestashop?: unknown }).prestashop;
	const maybeShoptet = (hostWindow as Window & { shoptet?: unknown }).shoptet;

	if (maybePrestashop) {
		return 'prestashop';
	}

	if (maybeShoptet) {
		return 'shoptet';
	}

	return 'unknown';
}
