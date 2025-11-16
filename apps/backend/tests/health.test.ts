import { describe, expect, it } from "bun:test";
import { buildHealthResponse } from "../api/health.impl";

describe("health endpoint helper", () => {
  it("builds the payload with provided metadata", () => {
    const response = buildHealthResponse({ version: "1.2.3", env: "test", now: new Date("2025-01-01T00:00:00.000Z") });

    expect(response.status).toBe("ok");
    expect(response.version).toBe("1.2.3");
    expect(response.env).toBe("test");
    expect(response.timestamp).toBe("2025-01-01T00:00:00.000Z");
  });
});
