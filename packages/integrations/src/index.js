export * from './commerce.js';
export function detectPlatform(hostWindow) {
    const maybePrestashop = hostWindow.prestashop;
    const maybeShoptet = hostWindow.shoptet;
    if (maybePrestashop) {
        return 'prestashop';
    }
    if (maybeShoptet) {
        return 'shoptet';
    }
    return 'unknown';
}
