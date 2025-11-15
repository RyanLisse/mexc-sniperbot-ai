import axios from "axios";
import { Effect } from "effect";
import { MEXCApiError } from "../lib/effect";
import { getMEXCConfig } from "../lib/env";
import { pooledHttpClient } from "../lib/http-client";
import type { MEXCSymbol } from "./mexc-client";

/**
 * Trading rules for a symbol
 */
export type ValidationRules = {
  minQty: number;
  maxQty: number;
  stepSize: number;
  minNotional: number;
  tickSize: number;
  baseAsset: string;
  quoteAsset: string;
  status: string;
};

/**
 * Extended symbol info with filters (from exchangeInfo endpoint)
 */
interface SymbolWithFilters extends MEXCSymbol {
  filters?: Array<{
    filterType: string;
    minQty?: string;
    maxQty?: string;
    stepSize?: string;
    minNotional?: string;
    tickSize?: string;
  }>;
}

/**
 * Exchange rules cache
 * Caches trading rules to avoid repeated API calls
 */
export class ExchangeRulesCache {
  private readonly rules: Map<string, ValidationRules> = new Map();
  private lastUpdate = 0;
  private readonly cacheTTL = 3_600_000; // 1 hour

  /**
   * Load exchange rules from MEXC API
   */
  loadRules = (): Effect.Effect<void, MEXCApiError> => {
    const self = this;
    return Effect.gen(function* () {
      // Check if cache is still valid
      if (Date.now() - self.lastUpdate < self.cacheTTL && self.rules.size > 0) {
        return;
      }

      // Fetch exchange info using pooled HTTP client
      const axiosInstance = pooledHttpClient.getInstance();
      const config = getMEXCConfig();

      const response = yield* Effect.tryPromise({
        try: () =>
          axiosInstance.get<{ symbols: SymbolWithFilters[] }>(
            `${config.baseUrl}/api/v3/exchangeInfo`
          ),
        catch: (error) => {
          if (axios.isAxiosError(error)) {
            return new MEXCApiError({
              message: `Failed to fetch exchange info: ${error.message}`,
              code: "EXCHANGE_INFO_FAILED",
              statusCode: error.response?.status ?? 0,
              timestamp: new Date(),
            });
          }
          return new MEXCApiError({
            message: `Failed to fetch exchange info: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "EXCHANGE_INFO_FAILED",
            statusCode: 0,
            timestamp: new Date(),
          });
        },
      });

      // Parse and cache rules for each symbol
      if (response.data.symbols) {
        for (const symbol of response.data.symbols) {
          const rules = self.parseSymbolFilters(symbol);
          if (rules) {
            self.rules.set(symbol.symbol, rules);
          }
        }
      }

      self.lastUpdate = Date.now();
    });
  };

  /**
   * Get validation rules for a symbol
   */
  getRules(symbol: string): ValidationRules | undefined {
    return this.rules.get(symbol);
  }

  setRules(symbol: string, rules: ValidationRules): void {
    this.rules.set(symbol, rules);
  }

  /**
   * Check if rules are cached for a symbol
   */
  hasRules(symbol: string): boolean {
    return this.rules.has(symbol);
  }

  /**
   * Parse symbol filters to extract validation rules
   */
  private parseSymbolFilters(
    symbol: SymbolWithFilters
  ): ValidationRules | null {
    if (!symbol.filters || symbol.status !== "ENABLED") {
      return null;
    }

    let minQty = 0;
    let maxQty = Number.MAX_SAFE_INTEGER;
    let stepSize = 0;
    let minNotional = 0;
    let tickSize = 0;

    for (const filter of symbol.filters) {
      if (filter.filterType === "LOT_SIZE") {
        minQty = Number.parseFloat(filter.minQty ?? "0");
        maxQty = Number.parseFloat(
          filter.maxQty ?? String(Number.MAX_SAFE_INTEGER)
        );
        stepSize = Number.parseFloat(filter.stepSize ?? "0");
      } else if (filter.filterType === "MIN_NOTIONAL") {
        minNotional = Number.parseFloat(filter.minNotional ?? "0");
      } else if (filter.filterType === "PRICE_FILTER") {
        tickSize = Number.parseFloat(filter.tickSize ?? "0");
      }
    }

    return {
      minQty,
      maxQty,
      stepSize,
      minNotional,
      tickSize,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      status: symbol.status,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.rules.clear();
    this.lastUpdate = 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.rules.size;
  }
}

// Export singleton instance
export const exchangeRulesCache = new ExchangeRulesCache();
