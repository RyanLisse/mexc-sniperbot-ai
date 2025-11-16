export function buildHealthResponse({ version, env, now = new Date() }) {
    return {
        status: "ok",
        timestamp: now.toISOString(),
        version,
        env,
    };
}
//# sourceMappingURL=health.impl.js.map