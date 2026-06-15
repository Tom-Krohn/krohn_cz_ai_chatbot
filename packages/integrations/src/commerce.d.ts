export type AddToCartInput = {
    platform: 'prestashop' | 'shoptet' | 'woocommerce' | 'shopify' | 'unknown';
    productId: string;
    quantity: number;
};
export type AddToCartResult = {
    success: boolean;
    message: string;
};
export declare function addToCart(input: AddToCartInput): Promise<AddToCartResult>;
//# sourceMappingURL=commerce.d.ts.map