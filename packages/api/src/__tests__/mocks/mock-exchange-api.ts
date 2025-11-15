/**
 * Mock Exchange API for deterministic testing
 * Simulates MEXC exchange behavior without real API calls
 */

export type MockOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  status: "NEW" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "REJECTED";
  executedQuantity: number;
  executedPrice?: number;
  createTime: number;
};

export type MockBalance = {
  asset: string;
  free: number;
  locked: number;
};

export class MockExchangeAPI {
  private balances = new Map<string, MockBalance>([
    ["USDT", { asset: "USDT", free: 10_000, locked: 0 }],
    ["BTC", { asset: "BTC", free: 0, locked: 0 }],
  ]);

  private prices = new Map<string, number>([["BTCUSDT", 45_000]]);

  private readonly orders = new Map<string, MockOrder>();

  /**
   * Set price for a symbol
   */
  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price);
  }

  /**
   * Get current price
   */
  getPrice(symbol: string): number {
    return this.prices.get(symbol) ?? 0;
  }

  /**
   * Set balance for a currency
   *
   * NOTE: defined as a public class property so tree-shaking/minification
   * cannot remove it, since our integration tests call this helper.
   */
  setBalance = (currency: string, amount: number): void => {
    const existing = this.balances.get(currency);
    if (existing) {
      existing.free = amount;
    } else {
      this.balances.set(currency, {
        asset: currency,
        free: amount,
        locked: 0,
      });
    }
  };

  /**
   * Get balance for a currency
   */
  getBalance(currency: string): number {
    return this.balances.get(currency)?.free ?? 0;
  }

  /**
   * Place a market buy order
   */
  async marketBuy(symbol: string, quantity: number): Promise<MockOrder> {
    const price = this.getPrice(symbol);
    const cost = quantity * price;
    const [base, quote] = symbol.split(/USDT|BTC/);

    const quoteBalance = this.balances.get(quote ?? "USDT");
    if (!quoteBalance || quoteBalance.free < cost) {
      throw new Error("Insufficient balance");
    }

    // Update balances
    quoteBalance.free -= cost;
    const baseBalance = this.balances.get(base ?? "BTC") ?? {
      asset: base ?? "BTC",
      free: 0,
      locked: 0,
    };
    baseBalance.free += quantity;
    this.balances.set(base ?? "BTC", baseBalance);

    // Create order
    const order: MockOrder = {
      id: `order_${Date.now()}`,
      symbol,
      side: "BUY",
      type: "MARKET",
      quantity,
      status: "FILLED",
      executedQuantity: quantity,
      executedPrice: price,
      createTime: Date.now(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Place a limit buy order
   */
  async limitBuy(
    symbol: string,
    quantity: number,
    price: number
  ): Promise<MockOrder> {
    const currentPrice = this.getPrice(symbol);
    if (price < currentPrice) {
      // Order filled immediately
      return this.marketBuy(symbol, quantity);
    }

    // Order placed but not filled
    const order: MockOrder = {
      id: `order_${Date.now()}`,
      symbol,
      side: "BUY",
      type: "LIMIT",
      quantity,
      price,
      status: "NEW",
      executedQuantity: 0,
      createTime: Date.now(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Get order status
   */
  getOrder(orderId: string): MockOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<MockOrder> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    order.status = "CANCELED";
    return order;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.balances = new Map([
      ["USDT", { asset: "USDT", free: 10_000, locked: 0 }],
      ["BTC", { asset: "BTC", free: 0, locked: 0 }],
    ]);
    this.prices = new Map([["BTCUSDT", 45_000]]);
    this.orders.clear();
  }

  /**
   * Simulate price movement
   */
  simulatePriceMovement(symbol: string, newPrice: number): void {
    this.setPrice(symbol, newPrice);

    // Check if any limit orders should be filled
    for (const order of this.orders.values()) {
      if (
        order.symbol === symbol &&
        order.status === "NEW" &&
        order.type === "LIMIT" &&
        order.price &&
        order.price >= newPrice
      ) {
        order.status = "FILLED";
        order.executedQuantity = order.quantity;
        order.executedPrice = newPrice;
      }
    }
  }
}

// Export singleton instance
export const mockExchangeAPI = new MockExchangeAPI();
