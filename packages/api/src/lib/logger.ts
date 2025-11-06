import { Effect, Layer, Context } from "effect";
import { getLoggingConfig } from "./env";

// Logger interface
export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
  info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
  warn: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void, never>;
  error: (message: string, error?: Error | Record<string, unknown>) => Effect.Effect<void, never>;
}

// Logger service tag
export const Logger = Context.Tag<Logger>("Logger");

// Structured logger implementation
class StructuredLogger implements Logger {
  private config = getLoggingConfig();
  
  private formatMessage(level: string, message: string, meta?: Record<string, unknown>) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    
    return JSON.stringify(logEntry);
  }
  
  debug = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (this.config.level === "debug") {
        console.debug(this.formatMessage("debug", message, meta));
      }
    });
  
  info = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (["debug", "info"].includes(this.config.level)) {
        console.info(this.formatMessage("info", message, meta));
      }
    });
  
  warn = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (["debug", "info", "warn"].includes(this.config.level)) {
        console.warn(this.formatMessage("warn", message, meta));
      }
    });
  
  error = (message: string, error?: Error | Record<string, unknown>) => 
    Effect.sync(() => {
      const errorMeta = error instanceof Error 
        ? { 
            error: error.message, 
            stack: error.stack,
            name: error.name 
          }
        : error || {};
      
      console.error(this.formatMessage("error", message, errorMeta));
    });
}

// Logger layer
export const LoggerLive = Layer.succeed(Logger, new StructuredLogger());

// Trading-specific logger functions
export const TradingLogger = {
  logListingDetected: (symbol: string, price: string) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("New listing detected", { symbol, price })
      )
    ),
  
  logTradeStarted: (tradeId: string, symbol: string, quantity: string) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Trade execution started", { tradeId, symbol, quantity })
      )
    ),
  
  logTradeCompleted: (tradeId: string, result: Record<string, unknown>) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Trade execution completed", { tradeId, result })
      )
    ),
  
  logTradeFailed: (tradeId: string, error: Error) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.error("Trade execution failed", { tradeId, error })
      )
    ),
  
  logApiCall: (method: string, endpoint: string, duration: number) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.debug("API call completed", { method, endpoint, duration })
      )
    ),
  
  logApiError: (method: string, endpoint: string, error: Error) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.error("API call failed", { method, endpoint, error })
      )
    ),
  
  logConfigurationUpdate: (userId: string, changes: Record<string, unknown>) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Configuration updated", { userId, changes })
      )
    ),
  
  logBotStatusChange: (fromStatus: string, toStatus: string) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Bot status changed", { fromStatus, toStatus })
      )
    ),
  
  logPerformanceMetric: (metric: string, value: number, unit?: string) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.debug("Performance metric", { metric, value, unit })
      )
    ),
  
  logSecurityEvent: (event: string, details: Record<string, unknown>) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.warn("Security event", { event, details })
      )
    ),
};

// Request logger middleware helper
export const createRequestLogger = (requestId: string) => ({
  logRequestStart: (method: string, path: string) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Request started", { requestId, method, path })
      )
    ),
  
  logRequestEnd: (method: string, path: string, statusCode: number, duration: number) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.info("Request completed", { 
          requestId, 
          method, 
          path, 
          statusCode, 
          duration 
        })
      )
    ),
  
  logRequestError: (method: string, path: string, error: Error) =>
    Logger.pipe(
      Effect.flatMap(logger => 
        logger.error("Request failed", { requestId, method, path, error })
      )
    ),
});

// Development logger with pretty printing
export class DevelopmentLogger implements Logger {
  private config = getLoggingConfig();
  
  private prettyPrint(level: string, message: string, meta?: Record<string, unknown>) {
    const colors = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m",  // green
      warn: "\x1b[33m",  // yellow
      error: "\x1b[31m", // red
    };
    
    const reset = "\x1b[0m";
    const timestamp = new Date().toISOString();
    const color = colors[level as keyof typeof colors] || "";
    
    console.log(`${color}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`);
    
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${color}Meta:${reset}`, meta);
    }
  }
  
  debug = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (this.config.level === "debug") {
        this.prettyPrint("debug", message, meta);
      }
    });
  
  info = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (["debug", "info"].includes(this.config.level)) {
        this.prettyPrint("info", message, meta);
      }
    });
  
  warn = (message: string, meta?: Record<string, unknown>) => 
    Effect.sync(() => {
      if (["debug", "info", "warn"].includes(this.config.level)) {
        this.prettyPrint("warn", message, meta);
      }
    });
  
  error = (message: string, error?: Error | Record<string, unknown>) => 
    Effect.sync(() => {
      const errorMeta = error instanceof Error 
        ? { 
            error: error.message, 
            stack: error.stack,
            name: error.name 
          }
        : error || {};
      
      this.prettyPrint("error", message, errorMeta);
    });
}

// Development logger layer
export const DevelopmentLoggerLive = Layer.succeed(Logger, new DevelopmentLogger());

// Logger factory based on environment
export const createLoggerLayer = () => {
  const config = getLoggingConfig();
  return config.isDevelopment ? DevelopmentLoggerLive : LoggerLive;
};
