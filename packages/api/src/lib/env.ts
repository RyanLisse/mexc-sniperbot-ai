import { Effect } from "effect";
import { z } from "zod";

// Environment schema validation
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // MEXC API Configuration
  MEXC_API_KEY: z.string().min(1, "MEXC_API_KEY is required"),
  MEXC_SECRET_KEY: z.string().min(1, "MEXC_SECRET_KEY is required"),
  MEXC_BASE_URL: z.string().url().default("https://api.mexc.com"),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Performance
  API_TIMEOUT_MS: z.string().transform(Number).default("5000"),
  DB_QUERY_TIMEOUT_MS: z.string().transform(Number).default("1000"),

  // Security
  ALLOWED_ORIGINS: z.string().default("http://localhost:3001"),
  CORS_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Trading Configuration
  MAX_TRADES_PER_HOUR: z.string().transform(Number).default("10"),
  DEFAULT_POLLING_INTERVAL_MS: z.string().transform(Number).default("5000"),
  DEFAULT_ORDER_TIMEOUT_MS: z.string().transform(Number).default("10000"),
});

// Environment type
export type Environment = z.infer<typeof envSchema>;

const FALLBACK_DATABASE_URL =
  "postgresql://localhost:5432/mexc_sniperbot_dev?sslmode=disable";
const FALLBACK_MEXC_KEY = "development-placeholder-key";
const FALLBACK_MEXC_SECRET = "development-placeholder-secret";

function buildDevelopmentFallbackEnv(): Environment {
  const fallbackInput = {
    DATABASE_URL:
      process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
        ? process.env.DATABASE_URL
        : FALLBACK_DATABASE_URL,
    MEXC_API_KEY:
      process.env.MEXC_API_KEY && process.env.MEXC_API_KEY.length > 0
        ? process.env.MEXC_API_KEY
        : FALLBACK_MEXC_KEY,
    MEXC_SECRET_KEY:
      process.env.MEXC_SECRET_KEY && process.env.MEXC_SECRET_KEY.length > 0
        ? process.env.MEXC_SECRET_KEY
        : FALLBACK_MEXC_SECRET,
    MEXC_BASE_URL: process.env.MEXC_BASE_URL ?? "https://api.mexc.com",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
    API_TIMEOUT_MS: process.env.API_TIMEOUT_MS ?? "5000",
    DB_QUERY_TIMEOUT_MS: process.env.DB_QUERY_TIMEOUT_MS ?? "1000",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "http://localhost:3001",
    CORS_ENABLED: process.env.CORS_ENABLED ?? "true",
    MAX_TRADES_PER_HOUR: process.env.MAX_TRADES_PER_HOUR ?? "10",
    DEFAULT_POLLING_INTERVAL_MS:
      process.env.DEFAULT_POLLING_INTERVAL_MS ?? "5000",
    DEFAULT_ORDER_TIMEOUT_MS:
      process.env.DEFAULT_ORDER_TIMEOUT_MS ?? "10000",
  };

  return envSchema.parse(fallbackInput);
}

const ENV_FALLBACK_REASON = "Environment validation failed";

// Environment validation effect
export const validateEnvironment = Effect.gen(function* () {
  const parsed = envSchema.safeParse(process.env);

  if (parsed.success) {
    return parsed.data;
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");

  if (nodeEnv === "production") {
    throw new Error(`${ENV_FALLBACK_REASON}: ${issues}`);
  }

  yield* Effect.logWarning(
    `${ENV_FALLBACK_REASON}. Using development fallback values.`,
    {
      nodeEnv,
      issues,
    }
  );

  return buildDevelopmentFallbackEnv();
});

// Cached environment variable
let cachedEnv: Environment | null = null;

export function getEnvironment(): Environment {
  if (cachedEnv) {
    return cachedEnv;
  }

  const env = Effect.runSync(validateEnvironment);
  cachedEnv = env;
  return env;
}

// Environment getters for specific configurations
export function getDatabaseConfig() {
  const env = getEnvironment();
  return {
    url: env.DATABASE_URL,
    queryTimeout: env.DB_QUERY_TIMEOUT_MS,
  };
}

export function getMEXCConfig() {
  const env = getEnvironment();
  return {
    apiKey: env.MEXC_API_KEY,
    secretKey: env.MEXC_SECRET_KEY,
    baseUrl: env.MEXC_BASE_URL,
    timeout: env.API_TIMEOUT_MS,
  };
}

export function getLoggingConfig() {
  const env = getEnvironment();
  return {
    level: env.LOG_LEVEL,
    isDevelopment: env.NODE_ENV === "development",
  };
}

export function getPerformanceConfig() {
  const env = getEnvironment();
  return {
    apiTimeout: env.API_TIMEOUT_MS,
    dbQueryTimeout: env.DB_QUERY_TIMEOUT_MS,
    maxTradesPerHour: env.MAX_TRADES_PER_HOUR,
    defaultPollingInterval: env.DEFAULT_POLLING_INTERVAL_MS,
    defaultOrderTimeout: env.DEFAULT_ORDER_TIMEOUT_MS,
  };
}

export function getSecurityConfig() {
  const env = getEnvironment();
  return {
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((origin) =>
      origin.trim()
    ),
    corsEnabled: env.CORS_ENABLED,
    isProduction: env.NODE_ENV === "production",
  };
}

// Environment validation for startup
export const validateStartupEnvironment = Effect.gen(function* () {
  const env = yield* validateEnvironment;

  // Validate critical configurations
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for application startup");
  }

  if (!(env.MEXC_API_KEY && env.MEXC_SECRET_KEY)) {
    throw new Error(
      "MEXC API credentials are required for trading functionality"
    );
  }

  yield* Effect.logInfo("Environment validation successful", {
    nodeEnv: env.NODE_ENV,
    mexcBaseUrl: env.MEXC_BASE_URL,
    logLevel: env.LOG_LEVEL,
  });

  return env;
});

// Helper to check if required environment variables are set
export function checkRequiredEnvVars(): boolean {
  try {
    getEnvironment();
    return true;
  } catch {
    return false;
  }
}
