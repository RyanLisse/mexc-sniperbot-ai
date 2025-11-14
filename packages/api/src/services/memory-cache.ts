import { LRUCache as LRU } from "lru-cache";
import { cacheHits, cacheMisses } from "./metrics-collector";

/**
 * LRU memory cache configuration
 */
const cacheOptions = {
  max: 1000,
  ttl: 5000, // 5 seconds default TTL
};

/**
 * Memory cache instances for different data types
 */
export const tickerPriceCache = new LRU<string, number>({
  ...cacheOptions,
  ttl: 5000, // 5s for ticker prices
});

export const orderBookCache = new LRU<string, unknown>({
  ...cacheOptions,
  ttl: 2000, // 2s for order book snapshots
});

export const klinesCache = new LRU<string, unknown>({
  ...cacheOptions,
  ttl: 60_000, // 60s for historical klines
});

export const exchangeInfoCache = new LRU<string, unknown>({
  ...cacheOptions,
  ttl: 3_600_000, // 1 hour for exchange info
});

/**
 * Get value from cache with metrics tracking
 */
export function getFromCache<T>(
  cache: LRU<string, T>,
  key: string,
  cacheType: string
): T | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    cacheHits.inc({ cache_type: cacheType });
    return value;
  }
  cacheMisses.inc({ cache_type: cacheType });
  return;
}

/**
 * Set value in cache
 */
export function setInCache<T>(
  cache: LRU<string, T>,
  key: string,
  value: T,
  ttl?: number
): void {
  if (ttl) {
    cache.set(key, value, { ttl });
  } else {
    cache.set(key, value);
  }
}
