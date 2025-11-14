import { logger } from "./pino-logger";

/**
 * Latency Tracker
 * Tracks and logs execution latencies
 */
export class LatencyTracker {
  /**
   * Calculate latency from detection to submission
   */
  calculate(detectedAt: Date, submittedAt: Date): number {
    const latencyMs = submittedAt.getTime() - detectedAt.getTime();

    logger.debug(
      {
        detectedAt: detectedAt.toISOString(),
        submittedAt: submittedAt.toISOString(),
        latencyMs,
      },
      `Calculated latency: ${latencyMs}ms`
    );

    return latencyMs;
  }

  /**
   * Track and log latency with context
   */
  track(params: {
    symbol: string;
    detectedAt: Date;
    submittedAt: Date;
    orderId?: string;
  }): number {
    const latencyMs = this.calculate(params.detectedAt, params.submittedAt);

    logger.info(
      {
        event: "latency_tracked",
        symbol: params.symbol,
        orderId: params.orderId,
        latencyMs,
      },
      `Order latency: ${latencyMs}ms for ${params.symbol}`
    );

    return latencyMs;
  }

  /**
   * Check if latency meets target (<1000ms)
   */
  meetsTarget(latencyMs: number, targetMs = 1000): boolean {
    const meets = latencyMs < targetMs;

    if (!meets) {
      logger.warn(
        {
          latencyMs,
          targetMs,
          exceeded: latencyMs - targetMs,
        },
        "Latency target not met"
      );
    }

    return meets;
  }
}

export const latencyTracker = new LatencyTracker();
