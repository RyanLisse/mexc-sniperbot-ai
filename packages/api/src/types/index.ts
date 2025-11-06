// Re-export database types
export * from "@mexc-sniperbot-ai/db";

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

// Pagination types
export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

// Trading types
export interface MarketData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  timestamp: number;
}

export interface OrderBook {
  symbol: string;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
  timestamp: number;
}

// Configuration types
export interface TradingConfigurationInput {
  enabledPairs: string[];
  maxPurchaseAmount: number;
  priceTolerance: number;
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval: number;
  orderTimeout: number;
  isActive: boolean;
}

export interface RiskManagementConfig {
  stopLossPercentage?: number;
  takeProfitPercentage?: number;
  maxPositionSize?: number;
  blacklistSymbols?: string[];
}

// Monitoring types
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: HealthCheck;
    mexcApi: HealthCheck;
    memory: HealthCheck;
  };
}

export interface HealthCheck {
  status: "pass" | "fail" | "warn";
  responseTime?: number;
  error?: string;
}

export interface PerformanceMetrics {
  timeframe: "1h" | "24h" | "7d" | "30d";
  totalListings: number;
  successfulTrades: number;
  failedTrades: number;
  averageExecutionTime: number;
  totalVolume: number;
  profitLoss: number;
  errorRate: number;
}

// Alert types
export interface Alert {
  id: string;
  type: "info" | "warning" | "error" | "critical";
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
}

// WebSocket types
export interface WebSocketMessage {
  type: "listing_detected" | "trade_executed" | "bot_status" | "alert";
  payload: unknown;
  timestamp: string;
}

export interface ListingDetectedMessage extends WebSocketMessage {
  type: "listing_detected";
  payload: {
    symbol: string;
    price: string;
    detectedAt: string;
  };
}

export interface TradeExecutedMessage extends WebSocketMessage {
  type: "trade_executed";
  payload: {
    tradeId: string;
    symbol: string;
    status: string;
    executedAt: string;
  };
}

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  permissions: string[];
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export const ErrorCode = {
  // Authentication errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  
  // Trading errors
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INVALID_SYMBOL: "INVALID_SYMBOL",
  ORDER_TOO_SMALL: "ORDER_TOO_SMALL",
  MARKET_CLOSED: "MARKET_CLOSED",
  
  // Configuration errors
  INVALID_PARAMETERS: "INVALID_PARAMETERS",
  CONFIGURATION_NOT_FOUND: "CONFIGURATION_NOT_FOUND",
  
  // System errors
  DATABASE_ERROR: "DATABASE_ERROR",
  API_ERROR: "API_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event types for the trading system
export interface TradingEvent {
  id: string;
  type: "listing_detected" | "trade_started" | "trade_completed" | "trade_failed" | "error";
  timestamp: string;
  data: unknown;
}

export interface ListingDetectedEvent extends TradingEvent {
  type: "listing_detected";
  data: {
    symbol: string;
    price: string;
    exchange: string;
  };
}

export interface TradeStartedEvent extends TradingEvent {
  type: "trade_started";
  data: {
    tradeId: string;
    symbol: string;
    quantity: string;
  };
}

// Database query options
export interface QueryOptions {
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
  where?: Record<string, unknown>;
}

// Export commonly used type guards
export function isAppError(error: unknown): error is AppError {
  return typeof error === "object" && error !== null && 
    "code" in error && "message" in error && "timestamp" in error;
}

export function isWebSocketMessage(message: unknown): message is WebSocketMessage {
  return typeof message === "object" && message !== null &&
    "type" in message && "payload" in message && "timestamp" in message;
}
