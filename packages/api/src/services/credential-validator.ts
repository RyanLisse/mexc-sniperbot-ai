import { Effect } from "effect";
import { TradingError, TradingLogger } from "../lib/effect";
import { getMEXCConfig } from "../lib/env";
import { mexcClient } from "./mexc-client";

export type CredentialValidationStatus = {
  isValid: boolean;
  lastValidated: Date | null;
  error?: string;
};

class CredentialValidator {
  private validationStatus: CredentialValidationStatus = {
    isValid: false,
    lastValidated: null,
  };
  private validationInterval: NodeJS.Timeout | null = null;
  private readonly VALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Validate MEXC API credentials by attempting to fetch account info
   */
  validateCredentials = (): Effect.Effect<CredentialValidationStatus, TradingError> => {
    return Effect.gen(function* () {
      const config = getMEXCConfig();

      if (!config.apiKey || !config.secretKey) {
        const error = "MEXC API credentials not configured";
        this.validationStatus = {
          isValid: false,
          lastValidated: new Date(),
          error,
        };
        yield* TradingLogger.logError("Credential validation failed", new Error(error));
        return this.validationStatus;
      }

      try {
        // Attempt to fetch account info to validate credentials
        yield* mexcClient.getAccountInfo();

        this.validationStatus = {
          isValid: true,
          lastValidated: new Date(),
        };

        yield* TradingLogger.logInfo("MEXC API credentials validated successfully");
        return this.validationStatus;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error during credential validation";
        this.validationStatus = {
          isValid: false,
          lastValidated: new Date(),
          error: errorMessage,
        };

        yield* TradingLogger.logError("Credential validation failed", error as Error);
        return this.validationStatus;
      }
    }).bind(this);
  };

  /**
   * Get current validation status (cached)
   */
  getStatus = (): CredentialValidationStatus => {
    return { ...this.validationStatus };
  };

  /**
   * Start periodic validation
   */
  startPeriodicValidation = (): void => {
    if (this.validationInterval) {
      return;
    }

    // Validate immediately
    Effect.runPromise(
      this.validateCredentials().pipe(
        Effect.catchAll((error) => {
          TradingLogger.logError("Periodic credential validation failed", error as Error);
          return Effect.void;
        })
      )
    );

    // Then validate periodically
    this.validationInterval = setInterval(() => {
      Effect.runPromise(
        this.validateCredentials().pipe(
          Effect.catchAll((error) => {
            TradingLogger.logError("Periodic credential validation failed", error as Error);
            return Effect.void;
          })
        )
      );
    }, this.VALIDATION_INTERVAL_MS);
  };

  /**
   * Stop periodic validation
   */
  stopPeriodicValidation = (): void => {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  };
}

export const credentialValidator = new CredentialValidator();


