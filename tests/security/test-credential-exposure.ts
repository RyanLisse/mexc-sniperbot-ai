import { describe, expect, it } from "bun:test";
import { credentialStorage } from "@mexc-sniperbot-ai/api/lib/credentials";
import { Effect } from "effect";

describe("Credential Exposure Prevention", () => {
  it("should not expose credentials in error messages", async () => {
    // Test that error messages don't contain actual credential values
    try {
      await Effect.runPromise(credentialStorage.getApiKey());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Ensure no actual API key is exposed
      expect(errorMessage).not.toContain(process.env.MEXC_API_KEY ?? "");
    }
  });

  it("should validate credentials without exposing them", async () => {
    // Test that validation doesn't expose credentials
    try {
      await Effect.runPromise(credentialStorage.validateCredentials());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Ensure no actual credentials are exposed
      expect(errorMessage).not.toContain(process.env.MEXC_API_KEY ?? "");
      expect(errorMessage).not.toContain(process.env.MEXC_SECRET_KEY ?? "");
    }
  });
});
