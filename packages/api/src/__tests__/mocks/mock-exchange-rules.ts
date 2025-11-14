/**
 * Mock exchange rules for testing
 * Simulates MEXC exchange rules without real API calls
 */

export type MockExchangeRule = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  minQty: string;
  maxQty: string;
  stepSize: string;
  tickSize: string;
  minNotional: string;
};

export const mockExchangeRules: MockExchangeRule[] = [
  {
    symbol: "BTCUSDT",
    status: "TRADING",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    minQty: "0.0001",
    maxQty: "10000",
    stepSize: "0.0001",
    tickSize: "0.01",
    minNotional: "5",
  },
  {
    symbol: "ETHUSDT",
    status: "TRADING",
    baseAsset: "ETH",
    quoteAsset: "USDT",
    minQty: "0.001",
    maxQty: "100000",
    stepSize: "0.001",
    tickSize: "0.01",
    minNotional: "5",
  },
  {
    symbol: "TRADEUSDT",
    status: "TRADING",
    baseAsset: "TRADE",
    quoteAsset: "USDT",
    minQty: "0.01",
    maxQty: "1000000",
    stepSize: "0.01",
    tickSize: "0.0001",
    minNotional: "5",
  },
];

/**
 * Get mock exchange rules for a symbol
 */
export function getMockExchangeRules(
  symbol: string
): MockExchangeRule | undefined {
  return mockExchangeRules.find((rule) => rule.symbol === symbol);
}

/**
 * Get all mock exchange rules
 */
export function getAllMockExchangeRules(): MockExchangeRule[] {
  return mockExchangeRules;
}
