import { Effect } from "effect";
import { SecurityError } from "../lib/effect";

export type ApiKeyValidationResult = {
  isValid: boolean;
  reason?: string;
  keyLength: number;
  keyPrefix: string;
};

const MIN_API_KEY_LENGTH = 32;
const MAX_API_KEY_LENGTH = 128;

export const apiKeyValidator = {
  validateApiKey(
    apiKey: string
  ): Effect.Effect<ApiKeyValidationResult, SecurityError> {
    return Effect.gen(function* () {
      if (!apiKey || apiKey.length === 0) {
        return {
          isValid: false,
          reason: "API key is empty",
          keyLength: 0,
          keyPrefix: "",
        };
      }

      if (apiKey.length < MIN_API_KEY_LENGTH) {
        return {
          isValid: false,
          reason: `API key is too short (minimum ${MIN_API_KEY_LENGTH} characters)`,
          keyLength: apiKey.length,
          keyPrefix: `${apiKey.substring(0, 8)}...`,
        };
      }

      if (apiKey.length > MAX_API_KEY_LENGTH) {
        return {
          isValid: false,
          reason: `API key is too long (maximum ${MAX_API_KEY_LENGTH} characters)`,
          keyLength: apiKey.length,
          keyPrefix: `${apiKey.substring(0, 8)}...`,
        };
      }

      // Check for valid characters (alphanumeric and some special chars)
      const validKeyPattern = /^[a-zA-Z0-9_-]+$/;
      if (!validKeyPattern.test(apiKey)) {
        return {
          isValid: false,
          reason: "API key contains invalid characters",
          keyLength: apiKey.length,
          keyPrefix: `${apiKey.substring(0, 8)}...`,
        };
      }

      return {
        isValid: true,
        keyLength: apiKey.length,
        keyPrefix: `${apiKey.substring(0, 8)}...`,
      };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new SecurityError({
            message: `API key validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "API_KEY_VALIDATION_ERROR",
            timestamp: new Date(),
          })
        )
      )
    );
  },

  validateSecretKey(
    secretKey: string
  ): Effect.Effect<ApiKeyValidationResult, SecurityError> {
    return Effect.gen(function* () {
      if (!secretKey || secretKey.length === 0) {
        return {
          isValid: false,
          reason: "Secret key is empty",
          keyLength: 0,
          keyPrefix: "",
        };
      }

      if (secretKey.length < MIN_API_KEY_LENGTH) {
        return {
          isValid: false,
          reason: `Secret key is too short (minimum ${MIN_API_KEY_LENGTH} characters)`,
          keyLength: secretKey.length,
          keyPrefix: `${secretKey.substring(0, 8)}...`,
        };
      }

      // Secret keys are typically hexadecimal
      const hexPattern = /^[a-fA-F0-9]+$/;
      if (!hexPattern.test(secretKey)) {
        return {
          isValid: false,
          reason: "Secret key must be hexadecimal",
          keyLength: secretKey.length,
          keyPrefix: `${secretKey.substring(0, 8)}...`,
        };
      }

      return {
        isValid: true,
        keyLength: secretKey.length,
        keyPrefix: `${secretKey.substring(0, 8)}...`,
      };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new SecurityError({
            message: `Secret key validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "SECRET_KEY_VALIDATION_ERROR",
            timestamp: new Date(),
          })
        )
      )
    );
  },

  validateApiCredentials(
    apiKey: string,
    secretKey: string
  ): Effect.Effect<
    { apiKey: ApiKeyValidationResult; secretKey: ApiKeyValidationResult },
    SecurityError
  > {
    return Effect.gen(function* () {
      const [apiKeyResult, secretKeyResult] = yield* Effect.all([
        this.validateApiKey(apiKey),
        this.validateSecretKey(secretKey),
      ]);

      return {
        apiKey: apiKeyResult,
        secretKey: secretKeyResult,
      };
    }).bind(undefined, this);
  },
};
