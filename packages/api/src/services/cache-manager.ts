import { getFromCache, setInCache, tickerPriceCache } from "./memory-cache";
import { getFromRedis, setInRedis } from "./redis-cache";

/**
 * Unified cache interface
 * Implements two-tier caching: L1 (memory LRU), L2 (Redis)
 */
export class CacheManager {
  /**
   * Get value from cache (L1 first, then L2)
   */
  async get<T>(
    key: string,
    cacheType: "ticker" | "orderbook" | "klines" | "exchangeInfo"
  ): Promise<T | null> {
    // L1: Memory cache
    const cache = this.getCacheForType(cacheType);
    const l1Value = getFromCache(cache, key, cacheType);
    if (l1Value !== undefined) {
      return l1Value as T;
    }

    // L2: Redis cache
    const l2Value = await getFromRedis<T>(key, cacheType);
    if (l2Value !== null) {
      // Populate L1 cache
      setInCache(cache, key, l2Value);
      return l2Value;
    }

    return null;
  }

  /**
   * Set value in both cache tiers
   */
  async set<T>(
    key: string,
    value: T,
    cacheType: "ticker" | "orderbook" | "klines" | "exchangeInfo",
    ttlSeconds?: number
  ): Promise<void> {
    // L1: Memory cache
    const cache = this.getCacheForType(cacheType);
    const memoryTtl = ttlSeconds ? ttlSeconds * 1000 : undefined;
    setInCache(cache, key, value, memoryTtl);

    // L2: Redis cache
    await setInRedis(key, value, ttlSeconds);
  }

  /**
   * Get cache instance for type
   */
  private getCacheForType(
    cacheType: "ticker" | "orderbook" | "klines" | "exchangeInfo"
  ) {
    switch (cacheType) {
      case "ticker":
        return tickerPriceCache;
      case "orderbook":
        return orderBookCache;
      case "klines":
        return klinesCache;
      case "exchangeInfo":
        return exchangeInfoCache;
      default:
        return tickerPriceCache;
    }
  }

  /**
   * Clear cache for a key
   */
  async clear(
    key: string,
    cacheType: "ticker" | "orderbook" | "klines" | "exchangeInfo"
  ): Promise<void> {
    const cache = this.getCacheForType(cacheType);
    cache.delete(key);
    await import("./redis-cache").then((m) => m.deleteFromRedis(key));
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
