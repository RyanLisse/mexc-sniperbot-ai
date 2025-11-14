import { Effect } from "effect";
import { SecurityError, TradingLogger } from "./effect";
import { getMEXCConfig } from "./env";

export type CredentialStorage = {
  getApiKey(): Effect.Effect<string, SecurityError>;
  getSecretKey(): Effect.Effect<string, SecurityError>;
  validateCredentials(): Effect.Effect<void, SecurityError>;
  rotateCredentials(
    newApiKey: string,
    newSecretKey: string
  ): Effect.Effect<void, SecurityError>;
};

class EnvironmentCredentialStorage implements CredentialStorage {
  getApiKey(): Effect.Effect<string, SecurityError> {
    return Effect.gen(function* () {
      const config = getMEXCConfig();
      if (!config.apiKey || config.apiKey.length === 0) {
        throw new SecurityError({
          message: "MEXC API key is not configured",
          code: "API_KEY_MISSING",
          timestamp: new Date(),
        });
      }
      return config.apiKey;
    });
  }

  getSecretKey(): Effect.Effect<string, SecurityError> {
    return Effect.gen(function* () {
      const config = getMEXCConfig();
      if (!config.secretKey || config.secretKey.length === 0) {
        throw new SecurityError({
          message: "MEXC secret key is not configured",
          code: "SECRET_KEY_MISSING",
          timestamp: new Date(),
        });
      }
      return config.secretKey;
    });
  }

  validateCredentials(): Effect.Effect<void, SecurityError> {
    return Effect.gen(function* () {
      const apiKey = yield* this.getApiKey();
      const secretKey = yield* this.getSecretKey();

      if (apiKey.length < 32) {
        throw new SecurityError({
          message: "API key appears to be invalid (too short)",
          code: "INVALID_API_KEY",
          timestamp: new Date(),
        });
      }

      if (secretKey.length < 32) {
        throw new SecurityError({
          message: "Secret key appears to be invalid (too short)",
          code: "INVALID_SECRET_KEY",
          timestamp: new Date(),
        });
      }

      yield* TradingLogger.logDebug("Credentials validated successfully");
    }).bind(undefined, this);
  }

  rotateCredentials(
    newApiKey: string,
    newSecretKey: string
  ): Effect.Effect<void, SecurityError> {
    return Effect.gen(function* () {
      // Validate new credentials
      if (!newApiKey || newApiKey.length < 32) {
        throw new SecurityError({
          message: "New API key is invalid",
          code: "INVALID_NEW_API_KEY",
          timestamp: new Date(),
        });
      }

      if (!newSecretKey || newSecretKey.length < 32) {
        throw new SecurityError({
          message: "New secret key is invalid",
          code: "INVALID_NEW_SECRET_KEY",
          timestamp: new Date(),
        });
      }

      // In a production system, this would update environment variables or a secrets manager
      // For now, we'll just log the rotation (actual rotation should be done via environment updates)
      yield* TradingLogger.logWarning("Credential rotation requested", {
        note: "Update MEXC_API_KEY and MEXC_SECRET_KEY environment variables",
        newApiKeyPrefix: `${newApiKey.substring(0, 8)}...`,
        newSecretKeyPrefix: `${newSecretKey.substring(0, 8)}...`,
      });

      // Note: In production, integrate with a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
      throw new SecurityError({
        message:
          "Credential rotation must be performed via environment variable updates",
        code: "ROTATION_REQUIRES_ENV_UPDATE",
        timestamp: new Date(),
      });
    }).bind(undefined, this);
  }
}

export const credentialStorage: CredentialStorage =
  new EnvironmentCredentialStorage();
