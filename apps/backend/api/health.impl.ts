import type { HealthResponse } from "./health.types";

export interface BuildHealthOptions {
  version: string;
  env: string;
  now?: Date;
}

export function buildHealthResponse({ version, env, now = new Date() }: BuildHealthOptions): HealthResponse {
  return {
    status: "ok",
    timestamp: now.toISOString(),
    version,
    env,
  };
}
