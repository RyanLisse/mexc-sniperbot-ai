import { secret } from "encore.dev/config";
import crypto from "crypto";
const mexcApiKey = secret("MEXCApiKey");
const mexcSecretKey = secret("MEXCSecretKey");
const MEXC_API_URL = "https://api.mexc.com/api/v3";
export class MEXCTradingClient {
    createSignature(queryString) {
        return crypto
            .createHmac("sha256", mexcSecretKey())
            .update(queryString)
            .digest("hex");
    }
    async placeOrder(symbol, side, type, quantity, price) {
        const timestamp = Date.now();
        const params = {
            symbol,
            side,
            type,
            quantity: quantity.toString(),
            timestamp: timestamp.toString(),
        };
        if (type === "LIMIT" && price) {
            params.price = price.toString();
            params.timeInForce = "GTC";
        }
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join("&");
        const signature = this.createSignature(queryString);
        const url = `${MEXC_API_URL}/order?${queryString}&signature=${signature}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-MEXC-APIKEY": mexcApiKey(),
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`MEXC API error: ${error}`);
        }
        return await response.json();
    }
    async cancelOrder(symbol, orderId) {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = this.createSignature(queryString);
        const url = `${MEXC_API_URL}/order?${queryString}&signature=${signature}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "X-MEXC-APIKEY": mexcApiKey(),
            },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to cancel order: ${error}`);
        }
    }
    async getOrderStatus(symbol, orderId) {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = this.createSignature(queryString);
        const url = `${MEXC_API_URL}/order?${queryString}&signature=${signature}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-MEXC-APIKEY": mexcApiKey(),
            },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get order status: ${error}`);
        }
        return await response.json();
    }
}
export const mexcTradingClient = new MEXCTradingClient();
//# sourceMappingURL=mexc-trading.js.map