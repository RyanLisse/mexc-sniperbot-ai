import type {
  DetectionSource,
  SignalConfidence,
} from "../services/listing-signal-service";

const SYMBOL_PATTERN = /^[A-Z0-9]+USDT$/;

/**
 * Signal validation result
 */
export type ValidationResult = {
  isValid: boolean;
  reason?: string;
  confidence?: SignalConfidence;
};

/**
 * Signal Validator
 * Validates listing signals for freshness, format, and confidence
 */
export class SignalValidator {
  /**
   * Validate a listing signal
   */
  validate(params: {
    symbol: string;
    detectionSource: DetectionSource;
    detectedAt: Date;
    freshnessDeadline: Date;
    confidence?: SignalConfidence;
  }): ValidationResult {
    const now = new Date();

    // Check symbol format
    if (!this.isValidSymbol(params.symbol)) {
      return {
        isValid: false,
        reason: `Invalid symbol format: ${params.symbol}`,
      };
    }

    // Check freshness
    if (params.freshnessDeadline < now) {
      return {
        isValid: false,
        reason: `Signal expired (deadline: ${params.freshnessDeadline.toISOString()})`,
      };
    }

    // Check detection time is not in future
    if (params.detectedAt > now) {
      return {
        isValid: false,
        reason: "Detection time is in the future",
      };
    }

    // Calculate confidence if not provided
    const confidence =
      params.confidence || this.calculateConfidence(params.detectionSource);

    return {
      isValid: true,
      confidence,
    };
  }

  /**
   * Check if symbol matches USDT pair format
   */
  isValidSymbol(symbol: string): boolean {
    return SYMBOL_PATTERN.test(symbol);
  }

  /**
   * Calculate confidence based on detection source
   */
  private calculateConfidence(source: DetectionSource): SignalConfidence {
    switch (source) {
      case "calendar":
        return "high"; // Calendar is authoritative
      case "ticker_diff":
        return "medium"; // Ticker diff is less certain
      default:
        return "low";
    }
  }

  /**
   * Check if signal is still fresh
   */
  isFresh(freshnessDeadline: Date): boolean {
    return freshnessDeadline > new Date();
  }

  /**
   * Get remaining freshness time in milliseconds
   */
  getRemainingFreshness(freshnessDeadline: Date): number {
    const remaining = freshnessDeadline.getTime() - Date.now();
    return Math.max(0, remaining);
  }
}

/**
 * Singleton instance
 */
export const signalValidator = new SignalValidator();
