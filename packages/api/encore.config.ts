/**
 * Encore environment-specific configuration
 *
 * This file defines runtime configuration for different deployment environments.
 * - local: Development with verbose logging
 * - dev: Staging environment in Tokyo region
 * - prod: Production environment with optimizations
 */

type EncoreConfig = {
  region: string;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    pretty: boolean;
  };
  database: {
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
  api: {
    requestTimeout: number;
    corsOrigins: string[];
  };
  mexc: {
    pollInterval: number; // seconds
    recvWindowMax: number; // milliseconds
  };
};

const configs: Record<string, EncoreConfig> = {
  local: {
    region: "local",
    logging: {
      level: "debug",
      pretty: true,
    },
    database: {
      maxConnections: 10,
      connectionTimeout: 30_000,
      idleTimeout: 600_000,
    },
    api: {
      requestTimeout: 30_000,
      corsOrigins: ["http://localhost:3000", "http://localhost:3001"],
    },
    mexc: {
      pollInterval: 5,
      recvWindowMax: 1000,
    },
  },

  dev: {
    region: "ap-northeast-1", // Tokyo
    logging: {
      level: "debug",
      pretty: false,
    },
    database: {
      maxConnections: 20,
      connectionTimeout: 30_000,
      idleTimeout: 600_000,
    },
    api: {
      requestTimeout: 30_000,
      corsOrigins: ["https://dev.mexc-sniper.app", "https://*.vercel.app"],
    },
    mexc: {
      pollInterval: 5,
      recvWindowMax: 1000,
    },
  },

  prod: {
    region: "ap-northeast-1", // Tokyo - lowest latency to MEXC
    logging: {
      level: "info",
      pretty: false,
    },
    database: {
      maxConnections: 50,
      connectionTimeout: 30_000,
      idleTimeout: 600_000,
    },
    api: {
      requestTimeout: 30_000,
      corsOrigins: ["https://mexc-sniper.app", "https://www.mexc-sniper.app"],
    },
    mexc: {
      pollInterval: 5,
      recvWindowMax: 1000,
    },
  },
};

/**
 * Get configuration for current environment
 */
export function getConfig(): EncoreConfig {
  const env = process.env.ENCORE_ENVIRONMENT || "local";
  const config = configs[env];

  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }

  return config;
}

/**
 * Environment-specific runtime settings
 */
export const config = getConfig();

/**
 * Database connection pool settings
 */
export const dbConfig = {
  max: config.database.maxConnections,
  connectionTimeoutMillis: config.database.connectionTimeout,
  idleTimeoutMillis: config.database.idleTimeout,
  allowExitOnIdle: false,
};

/**
 * API middleware settings
 */
export const apiConfig = {
  timeout: config.api.requestTimeout,
  cors: {
    origins: config.api.corsOrigins,
    credentials: true,
  },
};

/**
 * MEXC client settings
 */
export const mexcConfig = {
  pollIntervalSeconds: config.mexc.pollInterval,
  recvWindowMs: config.mexc.recvWindowMax,
  timeout: 10_000, // 10s timeout for MEXC API calls
  retries: 2,
};
