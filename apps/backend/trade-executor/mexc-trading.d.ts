import type { MEXCOrderResponse } from "./types";
export declare class MEXCTradingClient {
    private createSignature;
    placeOrder(symbol: string, side: "BUY" | "SELL", type: "MARKET" | "LIMIT", quantity: number, price?: number): Promise<MEXCOrderResponse>;
    cancelOrder(symbol: string, orderId: string): Promise<void>;
    getOrderStatus(symbol: string, orderId: string): Promise<MEXCOrderResponse>;
}
export declare const mexcTradingClient: MEXCTradingClient;
