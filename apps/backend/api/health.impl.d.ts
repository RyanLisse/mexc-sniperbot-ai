import type { HealthResponse } from "./health.types";
export interface BuildHealthOptions {
    version: string;
    env: string;
    now?: Date;
}
export declare function buildHealthResponse({ version, env, now }: BuildHealthOptions): HealthResponse;
