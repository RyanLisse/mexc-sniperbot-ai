import { logger } from "./pino-logger";

const MAX_RETRIES = 2;
const BASE_DELAY = 100; // ms

/**
 * Order Retry Logic
 * Exponential backoff with max 2 attempts
 */
export class OrderRetry {
  async execute<T>(
    fn: () => Promise<T>,
    context: { orderId?: string; symbol?: string }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = BASE_DELAY * 2 ** (attempt - 1);
          logger.info(
            {
              attempt: attempt + 1,
              delay,
              ...context,
            },
            `Retrying order after ${delay}ms delay`
          );

          await this.sleep(delay);
        }

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            error: lastError.message,
            ...context,
          },
          `Order attempt ${attempt + 1} failed`
        );

        // Don't retry on last attempt
        if (attempt === MAX_RETRIES - 1) {
          break;
        }
      }
    }

    logger.error(
      {
        attempts: MAX_RETRIES,
        error: lastError?.message,
        ...context,
      },
      "Order failed after all retry attempts"
    );

    throw lastError || new Error("Order failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const orderRetry = new OrderRetry();
