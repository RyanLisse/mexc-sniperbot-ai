import { Effect } from "effect";
import { type DatabaseError, TradingLogger } from "../lib/effect";
import { mexcClient } from "./mexc-client";

export type AccountBalance = {
  asset: string;
  free: string;
  locked: string;
  total: string;
  usdValue: number;
};

export type AccountInfo = {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  balances: AccountBalance[];
  totalUsdValue: number;
};

// Cache for account info (5 second TTL)
let cachedAccountInfo: AccountInfo | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

export const accountService = {
  getAccountInfo(): Effect.Effect<AccountInfo | null, DatabaseError> {
    return Effect.gen(function* () {
      const now = Date.now();

      // Return cached data if still valid
      if (cachedAccountInfo && now - cacheTimestamp < CACHE_TTL) {
        yield* TradingLogger.logDebug("Returning cached account info");
        return cachedAccountInfo;
      }

      yield* TradingLogger.logDebug("Fetching account info from MEXC API");

      // Fetch from MEXC API - catch errors and return null
      const mexcAccountInfo = yield* mexcClient.getAccountInfo().pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* TradingLogger.logDebug(
              "MEXC API unavailable, returning null",
              { error: error instanceof Error ? error.message : String(error) }
            );
            return null;
          })
        )
      );

      // If API returned null, return null
      if (!mexcAccountInfo) {
        return null;
      }

      // Transform balances and calculate USD values
      // Note: In production, you'd fetch current prices for each asset
      const balances: AccountBalance[] = mexcAccountInfo.balances
        .map((balance) => {
          const free = Number.parseFloat(balance.free);
          const locked = Number.parseFloat(balance.locked);
          const total = free + locked;

          // Mock USD value calculation - in production, fetch real prices
          let usdValue = 0;
          if (balance.asset === "USDT") {
            usdValue = total;
          } else if (balance.asset === "BTC") {
            usdValue = total * 43_000; // Mock BTC price
          } else if (balance.asset === "ETH") {
            usdValue = total * 2400; // Mock ETH price
          }

          return {
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked,
            total: total.toFixed(8),
            usdValue,
          };
        })
        .filter((balance) => Number.parseFloat(balance.total) > 0); // Only show assets with balance

      const totalUsdValue = balances.reduce(
        (sum, balance) => sum + balance.usdValue,
        0
      );

      const accountInfo: AccountInfo = {
        makerCommission: mexcAccountInfo.makerCommission,
        takerCommission: mexcAccountInfo.takerCommission,
        canTrade: mexcAccountInfo.canTrade,
        canWithdraw: mexcAccountInfo.canWithdraw,
        canDeposit: mexcAccountInfo.canDeposit,
        accountType: mexcAccountInfo.accountType,
        balances,
        totalUsdValue,
      };

      // Update cache
      cachedAccountInfo = accountInfo;
      cacheTimestamp = now;

      yield* TradingLogger.logInfo("Account info fetched successfully", {
        assetCount: balances.length,
        totalUsdValue,
      });

      return accountInfo;
    }).pipe(
      Effect.catchAll(() => {
        // Return null instead of failing to allow graceful degradation
        return Effect.succeed(null);
      })
    );
  },

  getAccountBalance(): Effect.Effect<AccountBalance[], DatabaseError> {
    return Effect.gen(function* () {
      const accountInfo = yield* this.getAccountInfo();
      // Return empty array if account info is null (API unavailable)
      if (!accountInfo) {
        return [];
      }
      return accountInfo.balances;
    }).bind(undefined, this);
  },

  getAssetBalance(
    asset: string
  ): Effect.Effect<AccountBalance | null, DatabaseError> {
    return Effect.gen(function* () {
      const balances = yield* this.getAccountBalance();
      return balances.find((b) => b.asset === asset) ?? null;
    }).bind(undefined, this);
  },

  getTotalUsdValue(): Effect.Effect<number, DatabaseError> {
    return Effect.gen(function* () {
      const accountInfo = yield* this.getAccountInfo();
      return accountInfo.totalUsdValue;
    }).bind(undefined, this);
  },

  // Clear cache (useful for testing or forced refresh)
  clearCache(): void {
    cachedAccountInfo = null;
    cacheTimestamp = 0;
  },
};
