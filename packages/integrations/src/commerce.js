export async function addToCart(input) {
    if (input.platform === 'unknown') {
        return {
            message: 'Unable to detect ecommerce platform.',
            success: false,
        };
    }
    if (input.platform === 'shoptet') {
        return {
            message: `Shoptet cart call queued for ${input.productId} x${input.quantity}.`,
            success: true,
        };
    }
    if (input.platform === 'prestashop') {
        return {
            message: `PrestaShop 8.2 cart flow queued for ${input.productId} x${input.quantity}.`,
            success: true,
        };
    }
    if (input.platform === 'woocommerce') {
        return {
            message: `WooCommerce Store API call queued for ${input.productId} x${input.quantity}.`,
            success: true,
        };
    }
    return {
        message: `Shopify Storefront call queued for ${input.productId} x${input.quantity}.`,
        success: true,
    };
}
