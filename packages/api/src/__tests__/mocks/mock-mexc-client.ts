/**
 * Mock MEXC Client for integration and performance tests
 * Simulates MEXC API without making real external calls
 */

import { Effect } from "effect";
import type { MEXCApiError } from "../../errors/mexc-error";

export interface MockOrder {
  symbol: string;
  orderId: string;
  clientOrderId?: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  status: "NEW" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "REJECTED";
  type: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
}

export interface MockBalance {
  asset: string;
  free: string;
  locked: string;
}

export class MockMEXCClient {
  private orders: Map<string, MockOrder> = new Map();
  private balances: Map<string, MockBalance> = new Map();
  private prices: Map<string, string> = new Map();
  private orderIdCounter = 1000;
  private requestDelay = 0; // Simulated latency in ms
  private failureRate = 0; // 0-1, probability of random failures

  constructor() {
    // Initialize with some default balances
    this.balances.set("USDT", { asset: "USDT", free: "10000", locked: "0" });
    this.balances.set("BTC", { asset: "BTC", free: "0", locked: "0" });
  }

  /**
   * Configure mock behavior
   */
  setRequestDelay(ms: number): void {
    this.requestDelay = ms;
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price.toString());
  }

  setBalance(asset: string, free: number, locked = 0): void {
    this.balances.set(asset, {
      asset,
      free: free.toString(),
      locked: locked.toString(),
    });
  }

  /**
   * Simulate network delay
   */
  private async delay(): Promise<void> {
    if (this.requestDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
    }
  }

  /**
   * Simulate random failures
   */
  private checkFailure(): void {
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error("Simulated API failure");
    }
  }

  /**
   * Place a market buy order
   */
  async placeMarketBuyOrder(
    symbol: string,
    quantity: string
  ): Promise<Effect.Effect<MockOrder, MEXCApiError>> {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        const orderId = `${this.orderIdCounter++}`;
        const price = this.prices.get(symbol) || "0";
        const qty = quantity;

        const order: MockOrder = {
          symbol,
          orderId,
          transactTime: Date.now(),
          price,
          origQty: qty,
          executedQty: qty,
          status: "FILLED",
          type: "MARKET",
          side: "BUY",
        };

        this.orders.set(orderId, order);

        // Update balances
        const [base, quote] = symbol.replace("USDT", " USDT").split(" ");
        const cost = Number.parseFloat(price) * Number.parseFloat(qty);

        const quoteBalance = this.balances.get(quote);
        if (quoteBalance) {
          const newFree = Number.parseFloat(quoteBalance.free) - cost;
          quoteBalance.free = newFree.toString();
        }

        const baseBalance = this.balances.get(base) || {
          asset: base,
          free: "0",
          locked: "0",
        };
        const newQty =
          Number.parseFloat(baseBalance.free) + Number.parseFloat(qty);
        baseBalance.free = newQty.toString();
        this.balances.set(base, baseBalance);

        return order;
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: string,
    price: string
  ): Promise<Effect.Effect<MockOrder, MEXCApiError>> {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        const orderId = `${this.orderIdCounter++}`;

        const order: MockOrder = {
          symbol,
          orderId,
          transactTime: Date.now(),
          price,
          origQty: quantity,
          executedQty: "0", // Limit orders start unfilled
          status: "NEW",
          type: "LIMIT",
          side,
        };

        this.orders.set(orderId, order);
        return order;
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Get order status
   */
  async getOrderStatus(
    symbol: string,
    orderId: string
  ): Promise<Effect.Effect<MockOrder | null, MEXCApiError>> {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        return this.orders.get(orderId) || null;
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Get account balances
   */
  async getAccountBalances(): Promise<
    Effect.Effect<MockBalance[], MEXCApiError>
  > {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        return Array.from(this.balances.values());
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Get ticker price
   */
  async getTickerPrice(
    symbol: string
  ): Promise<Effect.Effect<{ symbol: string; price: string }, MEXCApiError>> {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        const price = this.prices.get(symbol) || "0";
        return { symbol, price };
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    symbol: string,
    orderId: string
  ): Promise<Effect.Effect<MockOrder, MEXCApiError>> {
    return Effect.try({
      try: async () => {
        await this.delay();
        this.checkFailure();

        const order = this.orders.get(orderId);
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        order.status = "CANCELED";
        return order;
      },
      catch: (error) => {
        throw error;
      },
    });
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.orders.clear();
    this.balances.clear();
    this.prices.clear();
    this.orderIdCounter = 1000;
    this.requestDelay = 0;
    this.failureRate = 0;

    // Reinitialize defaults
    this.balances.set("USDT", { asset: "USDT", free: "10000", locked: "0" });
    this.balances.set("BTC", { asset: "BTC", free: "0", locked: "0" });
  }

  /**
   * Get all orders (for testing)
   */
  getAllOrders(): MockOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get statistics (for performance testing)
   */
  getStats(): {
    totalOrders: number;
    filledOrders: number;
    totalVolume: string;
  } {
    const orders = Array.from(this.orders.values());
    const filledOrders = orders.filter((o) => o.status === "FILLED");
    const totalVolume = filledOrders
      .reduce(
        (sum, o) =>
          sum + Number.parseFloat(o.executedQty) * Number.parseFloat(o.price),
        0
      )
      .toString();

    return {
      totalOrders: orders.length,
      filledOrders: filledOrders.length,
      totalVolume,
    };
  }
}

/**
 * Create a mock MEXC client instance
 */
export function createMockMEXCClient(): MockMEXCClient {
  return new MockMEXCClient();
}
