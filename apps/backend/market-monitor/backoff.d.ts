/**
 * Exponential backoff utility for WebSocket reconnection
 * Pattern: 1s → 2s → 4s → 8s → max 30s
 */
export interface BackoffConfig {
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
}
export declare const DEFAULT_BACKOFF_CONFIG: BackoffConfig;
/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export declare function calculateBackoffDelay(attempt: number, config?: BackoffConfig): number;
/**
 * Create a promise that resolves after backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Backoff configuration
 */
export declare function backoffSleep(attempt: number, config?: BackoffConfig): Promise<void>;
