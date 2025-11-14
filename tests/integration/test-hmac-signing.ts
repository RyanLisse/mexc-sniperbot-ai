import { describe, expect, it } from "bun:test";
import { createMEXCSigningService } from "@mexc-sniperbot-ai/api/services/mexc-signing";
import { Effect } from "effect";

describe("HMAC Signing Integration", () => {
  const testSecretKey =
    "test_secret_key_for_hmac_signing_validation_12345678901234567890";

  it("should generate valid HMAC SHA256 signature", async () => {
    const signingService = createMEXCSigningService(testSecretKey);
    const params = { symbol: "BTCUSDT", side: "BUY", type: "MARKET" };

    const result = await Effect.runPromise(signingService.signRequest(params));

    expect(result.queryString).toBeDefined();
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex string
  });

  it("should verify signature correctly", async () => {
    const signingService = createMEXCSigningService(testSecretKey);
    const params = { symbol: "ETHUSDT", quantity: "0.1" };

    const { queryString, signature } = await Effect.runPromise(
      signingService.signRequest(params)
    );

    const isValid = await Effect.runPromise(
      signingService.verifySignature(queryString, signature)
    );

    expect(isValid).toBe(true);
  });

  it("should reject invalid signature", async () => {
    const signingService = createMEXCSigningService(testSecretKey);
    const params = { symbol: "BTCUSDT" };

    const { queryString } = await Effect.runPromise(
      signingService.signRequest(params)
    );

    const isValid = await Effect.runPromise(
      signingService.verifySignature(queryString, "invalid_signature")
    );

    expect(isValid).toBe(false);
  });
});
