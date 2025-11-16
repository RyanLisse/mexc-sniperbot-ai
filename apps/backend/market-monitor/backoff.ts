/**
 * Exponential backoff utility for WebSocket reconnection
 * Pattern: 1s → 2s → 4s → 8s → max 30s
 */

export interface BackoffConfig {
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier: number;
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelay: 1000, // 1s
  maxDelay: 30000, // 30s
  multiplier: 2,
};

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.multiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Create a promise that resolves after backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Backoff configuration
 */
export async function backoffSleep(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): Promise<void> {
  const delay = calculateBackoffDelay(attempt, config);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
