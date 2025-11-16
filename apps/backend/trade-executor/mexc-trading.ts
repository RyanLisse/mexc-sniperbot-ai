import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import crypto from "crypto";
import type { MEXCOrderRequest, MEXCOrderResponse } from "./types";

const mexcApiKey = secret("MEXCApiKey");
const mexcSecretKey = secret("MEXCSecretKey");

const MEXC_API_URL = "https://api.mexc.com/api/v3";

export class MEXCTradingClient {
  private createSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", mexcSecretKey())
      .update(queryString)
      .digest("hex");
  }

  async placeOrder(
    symbol: string,
    side: "BUY" | "SELL",
    type: "MARKET" | "LIMIT",
    quantity: number,
    price?: number
  ): Promise<MEXCOrderResponse> {
    const timestamp = Date.now();

    const params: Record<string, string> = {
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

    return await response.json() as MEXCOrderResponse;
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
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

  async getOrderStatus(symbol: string, orderId: string): Promise<MEXCOrderResponse> {
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

    return await response.json() as MEXCOrderResponse;
  }
}

export const mexcTradingClient = new MEXCTradingClient();
