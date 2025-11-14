import { describe, expect, it } from "bun:test";
import { apiKeyValidator } from "@mexc-sniperbot-ai/api/services/api-key-validator";
import { Effect } from "effect";

describe("API Security", () => {
  it("should validate API key format", async () => {
    const validKey = "a".repeat(32); // Minimum length
    const result = await Effect.runPromise(
      apiKeyValidator.validateApiKey(validKey)
    );

    expect(result.isValid).toBe(true);
    expect(result.keyLength).toBe(32);
  });

  it("should reject short API keys", async () => {
    const shortKey = "a".repeat(10);
    const result = await Effect.runPromise(
      apiKeyValidator.validateApiKey(shortKey)
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("too short");
  });

  it("should validate secret key format", async () => {
    const validSecret = "a".repeat(64); // Hex string
    const result = await Effect.runPromise(
      apiKeyValidator.validateSecretKey(validSecret)
    );

    expect(result.isValid).toBe(true);
  });

  it("should reject non-hexadecimal secret keys", async () => {
    const invalidSecret = "g".repeat(64); // Contains 'g' which is not hex
    const result = await Effect.runPromise(
      apiKeyValidator.validateSecretKey(invalidSecret)
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("hexadecimal");
  });
});
