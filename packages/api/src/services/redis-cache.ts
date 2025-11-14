import Redis from "ioredis";
import { cacheHits, cacheMisses } from "./metrics-collector";

/**
 * Redis client instance
 */
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on("error", (error) => {
    console.error("Redis error:", error);
  });

  redisClient.on("connect", () => {
    console.log("Redis connected");
  });

  return redisClient;
}

/**
 * Get value from Redis cache with metrics tracking
 */
export async function getFromRedis<T>(
  key: string,
  cacheType: string
): Promise<T | null> {
  const client = getRedisClient();
  try {
    const value = await client.get(key);
    if (value) {
      cacheHits.inc({ cache_type: cacheType });
      return JSON.parse(value) as T;
    }
    cacheMisses.inc({ cache_type: cacheType });
    return null;
  } catch (error) {
    console.error(`Redis get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in Redis cache
 */
export async function setInRedis<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedisClient();
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    console.error(`Redis set error for key ${key}:`, error);
  }
}

/**
 * Delete value from Redis cache
 */
export async function deleteFromRedis(key: string): Promise<void> {
  const client = getRedisClient();
  try {
    await client.del(key);
  } catch (error) {
    console.error(`Redis delete error for key ${key}:`, error);
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
