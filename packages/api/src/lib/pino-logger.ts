import pino from "pino";
import { getLoggingConfig } from "./env";

/**
 * Pino logger instance with redaction for sensitive data
 */
export const logger = pino({
  level: getLoggingConfig().level,
  redact: {
    paths: ["apiKey", "apiSecret", "secretKey", "password", "token"],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with context
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Trading-specific logger with structured logging
 */
export const tradingLogger = {
  info: (message: string, context?: Record<string, unknown>) => {
    logger.info({ ...context, component: "trading" }, message);
  },

  error: (message: string, error?: Error | Record<string, unknown>) => {
    if (error instanceof Error) {
      logger.error(
        {
          component: "trading",
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        },
        message
      );
    } else {
      logger.error({ component: "trading", ...error }, message);
    }
  },

  debug: (message: string, context?: Record<string, unknown>) => {
    logger.debug({ ...context, component: "trading" }, message);
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    logger.warn({ ...context, component: "trading" }, message);
  },

  logTrade: (
    orderId: string,
    symbol: string,
    side: string,
    quantity: string,
    price?: string,
    executionTime?: number
  ) => {
    logger.info(
      {
        component: "trading",
        event: "trade_executed",
        orderId,
        symbol,
        side,
        quantity,
        price,
        executionTime,
      },
      `Trade executed: ${side} ${quantity} ${symbol}`
    );
  },

  logApiCall: (
    method: string,
    endpoint: string,
    duration: number,
    statusCode?: number
  ) => {
    logger.debug(
      {
        component: "api",
        method,
        endpoint,
        duration,
        statusCode,
      },
      `API call: ${method} ${endpoint}`
    );
  },
};
