import { Effect } from "effect";
import { createHmac } from "crypto";
import { MEXCApiError } from "../lib/effect";

// Signing service for MEXC API authentication
export class MEXCSigningService {
  private readonly secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  // Generate HMAC SHA256 signature for MEXC API requests
  generateSignature = (queryString: string): Effect.Effect<string, MEXCApiError> => {
    return Effect.try({
      try: () => {
        const hmac = createHmac("sha256", this.secretKey);
        hmac.update(queryString);
        return hmac.digest("hex");
      },
      catch: (error) => new MEXCApiError({
        message: `Signature generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "SIGNATURE_GENERATION_FAILED",
        statusCode: 0,
        timestamp: new Date(),
      }),
    });
  };

  // Validate that the secret key is properly formatted
  validateSecretKey = (): Effect.Effect<void, MEXCApiError> => {
    return Effect.gen(function* () {
      if (!this.secretKey || this.secretKey.length === 0) {
        throw new MEXCApiError({
          message: "Secret key is empty or undefined",
          code: "INVALID_SECRET_KEY",
          statusCode: 0,
          timestamp: new Date(),
        });
      }

      if (this.secretKey.length < 32) {
        throw new MEXCApiError({
          message: "Secret key appears to be too short (minimum 32 characters expected)",
          code: "SECRET_KEY_TOO_SHORT",
          statusCode: 0,
          timestamp: new Date(),
        });
      }

      // Check for valid characters (hexadecimal for API keys)
      const validKeyPattern = /^[a-fA-F0-9]+$/;
      if (!validKeyPattern.test(this.secretKey)) {
        throw new MEXCApiError({
          message: "Secret key contains invalid characters (expected hexadecimal only)",
          code: "INVALID_SECRET_KEY_FORMAT",
          statusCode: 0,
          timestamp: new Date(),
        });
      }
    });
  };

  // Create query string with timestamp for signing
  createQueryString = (
    params: Record<string, string | number>,
    timestamp?: number
  ): Effect.Effect<string, MEXCApiError> => {
    return Effect.gen(function* () {
      const validTimestamp = timestamp ?? Date.now();
      
      // Validate timestamp
      if (typeof validTimestamp !== "number" || validTimestamp <= 0) {
        throw new MEXCApiError({
          message: "Invalid timestamp provided",
          code: "INVALID_TIMESTAMP",
          statusCode: 0,
          timestamp: new Date(),
        });
      }

      // Create query parameters object with required fields
      const queryParams = {
        ...params,
        timestamp: validTimestamp.toString(),
        recvWindow: "5000", // 5 seconds receive window
      };

      // Sort parameters alphabetically (required by MEXC)
      const sortedParams = Object.keys(queryParams)
        .sort()
        .reduce((result, key) => {
          const value = queryParams[key];
          if (value !== undefined && value !== null) {
            result[key] = value.toString();
          }
          return result;
        }, {} as Record<string, string>);

      // Create query string
      const queryString = new URLSearchParams(sortedParams).toString();
      
      return queryString;
    });
  };

  // Complete signing process: create query string and generate signature
  signRequest = (
    params: Record<string, string | number>,
    timestamp?: number
  ): Effect.Effect<{ queryString: string; signature: string }, MEXCApiError> => {
    return Effect.gen(function* () {
      // First validate the secret key
      yield* this.validateSecretKey();

      // Create query string
      const queryString = yield* this.createQueryString(params, timestamp);

      // Generate signature
      const signature = yield* this.generateSignature(queryString);

      return {
        queryString,
        signature,
      };
    });
  };

  // Verify signature (useful for testing and debugging)
  verifySignature = (
    queryString: string,
    expectedSignature: string
  ): Effect.Effect<boolean, MEXCApiError> => {
    return Effect.gen(function* () {
      const actualSignature = yield* this.generateSignature(queryString);
      return actualSignature === expectedSignature;
    });
  };

  // Get signature info for debugging
  getSignatureInfo = (): Effect.Effect<{
    secretKeyLength: number;
    secretKeyPrefix: string;
    algorithm: string;
  }, MEXCApiError> => {
    return Effect.gen(function* () {
      yield* this.validateSecretKey();

      return {
        secretKeyLength: this.secretKey.length,
        secretKeyPrefix: this.secretKey.substring(0, 8) + "...",
        algorithm: "HMAC-SHA256",
      };
    });
  };
}

// Factory function to create signing service
export const createMEXCSigningService = (secretKey: string): MEXCSigningService => {
  return new MEXCSigningService(secretKey);
};

// Helper function to quickly sign a request
export const signMEXCRequest = (
  secretKey: string,
  params: Record<string, string | number>,
  timestamp?: number
): Effect.Effect<{ queryString: string; signature: string }, MEXCApiError> => {
  const signingService = createMEXCSigningService(secretKey);
  return signingService.signRequest(params, timestamp);
};

// Export the signing service class for dependency injection
export { MEXCSigningService };
