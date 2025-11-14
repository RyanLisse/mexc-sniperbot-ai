import { logger } from "./pino-logger";

const MAX_RECV_WINDOW = 1000; // MEXC max recvWindow in ms

/**
 * RecvWindow Validator
 * Enforces MEXC recvWindow constraint (max 1000ms)
 */
export class RecvWindowValidator {
  /**
   * Check if signal is still fresh enough for MEXC order
   * Returns true if signal is valid (within recv window)
   */
  isValid(detectedAt: Date, recvWindow: number): boolean {
    const now = Date.now();
    const detectedTime = detectedAt.getTime();
    const age = now - detectedTime;

    if (recvWindow > MAX_RECV_WINDOW) {
      logger.warn(
        { recvWindow, max: MAX_RECV_WINDOW },
        "recvWindow exceeds MEXC maximum"
      );
      return false;
    }

    const isValid = age <= recvWindow;

    if (!isValid) {
      logger.debug(
        {
          age,
          recvWindow,
          exceeded: age - recvWindow,
        },
        "Signal expired (recvWindow exceeded)"
      );
    }

    return isValid;
  }

  /**
   * Get signal age in milliseconds
   */
  getAge(detectedAt: Date): number {
    return Date.now() - detectedAt.getTime();
  }

  /**
   * Get remaining time within recv window
   */
  getRemainingTime(detectedAt: Date, recvWindow: number): number {
    const age = this.getAge(detectedAt);
    return Math.max(0, recvWindow - age);
  }
}

export const recvWindowValidator = new RecvWindowValidator();
