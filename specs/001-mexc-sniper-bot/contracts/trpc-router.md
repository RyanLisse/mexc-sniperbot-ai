# tRPC Router Contracts

**Purpose**: API endpoint definitions for MEXC Sniper Bot AI
**Created**: 2025-01-06
**Feature**: [spec.md](./spec.md)

## Router Structure

```typescript
// Root router
export const appRouter = router({
  configuration: configurationRouter,
  trading: tradingRouter,
  monitoring: monitoringRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

## Configuration Router

```typescript
export const configurationRouter = router({
  // Get current trading configuration
  getConfiguration: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns user's current TradingConfiguration
    }),

  // Update trading parameters
  updateConfiguration: protectedProcedure
    .input(z.object({
      enabledPairs: z.array(z.string()),
      maxPurchaseAmount: z.number().positive(),
      priceTolerance: z.number().min(0.1).max(50),
      dailySpendingLimit: z.number().positive(),
      maxTradesPerHour: z.number().min(1),
      pollingInterval: z.number().min(1000),
      orderTimeout: z.number().min(5000),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Updates and returns TradingConfiguration
    }),

  // Reset configuration to defaults
  resetConfiguration: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Resets to safe default values
    }),
});
```

## Trading Router

```typescript
export const tradingRouter = router({
  // Get recent trade attempts
  getTradeHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.enum(['PENDING', 'FILLED', 'FAILED', 'CANCELLED']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns paginated TradeAttempt records
    }),

  // Get specific trade details
  getTradeDetails: protectedProcedure
    .input(z.object({
      tradeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns detailed TradeAttempt information
    }),

  // Get active listings being monitored
  getActiveListings: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns ListingEvent records with status DETECTED/PROCESSING
    }),

  // Manual trade trigger (for testing/emergency)
  executeManualTrade: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      quantity: z.number().positive(),
      type: z.enum(['MARKET', 'LIMIT']),
      price: z.number().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Executes manual trade with validation
    }),

  // Cancel pending trade
  cancelTrade: protectedProcedure
    .input(z.object({
      tradeId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Cancels pending order at MEXC
    }),
});
```

## Monitoring Router

```typescript
export const monitoringRouter = router({
  // Get current bot status
  getBotStatus: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns current BotStatus with health metrics
    }),

  // Get performance metrics
  getPerformanceMetrics: protectedProcedure
    .input(z.object({
      timeframe: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
    }))
    .query(async ({ input, ctx }) => {
      // Returns aggregated performance data
    }),

  // Get system health
  getSystemHealth: publicProcedure
    .query(async () => {
      // Returns basic health check (no auth required)
    }),

  // Get recent alerts
  getAlerts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns recent system alerts and notifications
    }),

  // Test MEXC API connectivity
  testApiConnectivity: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Tests MEXC API connection and returns latency
    }),
});
```

## Authentication Router

```typescript
export const authRouter = router({
  // User login
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      // Authenticates user and returns session token
    }),

  // User logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Invalidates session token
    }),

  // Get current user
  getCurrentUser: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns current user information
    }),

  // Refresh session
  refreshSession: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Refreshes access token
    }),

  // Change password
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      // Updates user password
    }),
});
```

## Real-time Subscriptions

```typescript
export const subscriptionRouter = router({
  // Subscribe to bot status updates
  onBotStatusUpdate: protectedProcedure
    .subscription(() => {
      // Observable<BotStatus> for real-time dashboard
    }),

  // Subscribe to new listings
  onNewListing: protectedProcedure
    .subscription(() => {
      // Observable<ListingEvent> for new detections
    }),

  // Subscribe to trade updates
  onTradeUpdate: protectedProcedure
    .input(z.object({
      tradeId: z.string().uuid().optional(),
    }))
    .subscription(({ input }) => {
      // Observable<TradeAttempt> for specific or all trades
    }),

  // Subscribe to system alerts
  onSystemAlert: protectedProcedure
    .input(z.object({
      severity: z.enum(['WARNING', 'ERROR', 'CRITICAL']).optional(),
    }))
    .subscription(({ input }) => {
      // Observable<Alert> for real-time notifications
    }),
});
```

## Input/Output Types

### Configuration Types
```typescript
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

export interface TradingConfigurationOutput {
  id: string;
  userId: string;
  ...TradingConfigurationInput;
  createdAt: Date;
  updatedAt: Date;
}
```

### Trade Types
```typescript
export interface TradeAttemptOutput {
  id: string;
  listingEventId: string;
  symbol: string;
  side: "BUY";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  status: TradeStatus;
  orderId?: string;
  executedQuantity?: number;
  executedPrice?: number;
  commission?: number;
  detectedAt: Date;
  submittedAt: Date;
  completedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

export interface ListingEventOutput {
  id: string;
  symbol: string;
  exchangeName: string;
  listingTime: Date;
  baseAsset: string;
  quoteAsset: string;
  status: ListingStatus;
  initialPrice?: number;
  currentPrice?: number;
  priceChange24h?: number;
  processed: boolean;
  tradeAttemptId?: string;
  detectedAt: Date;
  expiresAt: Date;
}
```

### Monitoring Types
```typescript
export interface BotStatusOutput {
  id: string;
  isRunning: boolean;
  lastHeartbeat: Date;
  mexcApiStatus: ApiStatus;
  lastApiCheck: Date;
  apiResponseTime: number;
  listingsDetected24h: number;
  tradesExecuted24h: number;
  averageExecutionTime: number;
  consecutiveErrors: number;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  currentConfigurationId: string;
  configurationVersion: number;
  updatedAt: Date;
}

export interface PerformanceMetrics {
  timeframe: string;
  totalListings: number;
  successfulTrades: number;
  failedTrades: number;
  averageExecutionTime: number;
  totalVolume: number;
  profitLoss: number;
  errorRate: number;
}
```

## Error Handling

### Error Types
```typescript
export enum TradingError {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_SYMBOL = "INVALID_SYMBOL",
  ORDER_TOO_SMALL = "ORDER_TOO_SMALL",
  MARKET_CLOSED = "MARKET_CLOSED",
  API_ERROR = "API_ERROR",
  CONFIGURATION_INVALID = "CONFIGURATION_INVALID",
}

export enum ConfigurationError {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  LIMITS_EXCEEDED = "LIMITS_EXCEEDED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
}

export enum AuthenticationError {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
}
```

### Error Response Format
```typescript
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId: string;
}
```

## Rate Limiting

### Endpoint Limits
- Configuration updates: 10 per minute per user
- Trade execution: 60 per minute per user (MEXC limit)
- Monitoring queries: 100 per minute per user
- Authentication: 5 per minute per IP

### Implementation
```typescript
// Rate limiting middleware example
const rateLimitMiddleware = t.procedure
  .use(async ({ next, ctx }) => {
    // Implement Redis-based rate limiting
    return next();
  });
```

## Security Considerations

### Authentication
- JWT tokens with 15-minute expiration
- Refresh tokens with 7-day expiration
- Secure, HttpOnly cookies for token storage
- CSRF protection for state-changing operations

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Audit logging for all trading operations

### Input Validation
- Zod schema validation for all inputs
- SQL injection prevention through parameterized queries
- XSS protection through proper output encoding

## Performance Optimizations

### Caching Strategy
- Redis caching for configuration data
- In-memory caching for market data
- CDN caching for static assets

### Database Optimization
- Connection pooling
- Query optimization with proper indexes
- Read replicas for monitoring queries

### Response Optimization
- Pagination for large datasets
- Field selection for mobile clients
- Compression for API responses

This contract definition provides comprehensive type-safe API coverage for all user stories while maintaining constitution compliance.
