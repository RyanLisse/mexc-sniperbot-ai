# MEXC Sniper Bot API

Encore.dev backend service for the MEXC Sniper Bot trading system.

## Architecture

This package contains the Encore backend service that handles:

- **Listing Detection**: Dual-source polling (calendar + ticker diff) for new MEXC listings
- **Trade Execution**: Sub-second order placement via mexc-api-sdk
- **Safety Constraints**: Pre-trade validation for spend limits and rate limits
- **Bot Lifecycle**: Start/stop commands, status monitoring, heartbeat tracking
- **Audit Logging**: Immutable trade ledger with full exchange responses

## Local Development

### Prerequisites

- [Encore CLI](https://encore.dev/docs/install) v1.50.0+
- Bun 1.3.0+
- PostgreSQL (via Encore or local)
- MEXC API credentials

### Setup

```bash
# Install dependencies
bun install

# Set local secrets
encore secret set --type local MexcApiKey "your-mexc-api-key"
encore secret set --type local MexcApiSecret "your-mexc-api-secret"

# Run Encore dev server
encore run

# In another terminal, run database migrations
cd ../db
bun run db:push
```

The Encore dev server will start on `http://localhost:4000` with:
- API endpoints at `http://localhost:4000`
- Development dashboard at `http://localhost:9400`

### Available Scripts

- `encore run` - Start Encore dev server with hot reload
- `encore test` - Run Encore test suite
- `bun test` - Run unit tests with Vitest
- `bun run build` - Build TypeScript

## Project Structure

```
packages/api/
├── encore.app              # Encore app metadata
├── encore.service.ts       # Service definition
├── secrets.ts              # Encore secrets schema
├── db.ts                   # Database connection
├── src/
│   ├── endpoints/          # API endpoints
│   │   ├── bot-control.ts
│   │   ├── configurations.ts
│   │   └── trade-logs.ts
│   ├── services/           # Business logic
│   │   ├── configuration-service.ts
│   │   ├── bot-run-service.ts
│   │   ├── mexc-client.ts
│   │   └── ...
│   ├── workflows/          # Encore workflows
│   │   └── trader-workflow.ts
│   ├── cron/               # Scheduled jobs
│   │   └── listing-scanner-cron.ts
│   ├── lib/                # Utilities
│   │   ├── logger.ts
│   │   ├── safety-validator.ts
│   │   └── ...
│   └── types/              # Shared types
│       ├── bot.ts
│       └── trade.ts
```

## Configuration

### Secrets

Required secrets (set via `encore secret set`):

- `MexcApiKey` - MEXC API key
- `MexcApiSecret` - MEXC API secret

### Environment Config

Environment-specific settings in `encore.config.ts`:

- **local**: Tokyo region simulation, verbose logging
- **dev**: ap-northeast-1, debug logs
- **prod**: ap-northeast-1, info logs, connection pooling

## Key Features

### Listing Scanner

Polls MEXC calendar and ticker endpoints every 5 seconds to detect new listings:

```typescript
// Runs via Encore Cron Job
@cron("every 5 seconds")
async function scanListings() {
  // Calendar + ticker diff detection
  // Creates ListingSignal records
}
```

### Trade Workflow

Encore workflow for atomic trade execution:

```typescript
// packages/api/workflows/trader-workflow.ts
async function executeTrade(signal: ListingSignal) {
  // 1. Validate signal freshness (recvWindow)
  // 2. Check safety constraints
  // 3. Submit MARKET order to MEXC
  // 4. Create TradeLog entry
}
```

### Safety Constraints

Pre-trade validation prevents runaway spending:

- `maxTradesPerHour` - Rate limit per configuration
- `maxDailySpend` - Total quote currency cap
- `recvWindow` ≤ 1000ms - Signal staleness check
- Symbol-level concurrency limits

## API Endpoints

### Bot Control

- `POST /bot/start` - Start bot with configuration
- `POST /bot/stop` - Graceful shutdown
- `GET /bot/status` - Current status + metrics

### Configuration Management

- `POST /configurations` - Create new configuration
- `GET /configurations` - List all configurations
- `GET /configurations/:id` - Get specific config

### Trade Logs

- `GET /trades` - Query trade history
- `GET /trades/:id` - Get trade details
- `GET /trades/export` - Download CSV audit log

## Performance Goals

- **Start/Stop Latency**: <2s acknowledgement
- **Signal → Order**: <1s median submission time
- **DB Write Latency**: <100ms for Encore DB operations
- **Dashboard Polling**: ≥99% success rate, ≤5s staleness

## Testing

```bash
# Run Encore test suite
encore test

# Run unit tests
bun test

# Run integration tests
bun test:integration

# Run with coverage
bun test:coverage
```

## Deployment

### Encore Cloud (Production)

```bash
# Deploy to production (Tokyo region)
encore deploy prod

# View deployment status
encore status
```

### Environment Variables

Production secrets are managed via [Encore Cloud dashboard](https://app.encore.dev):
1. Navigate to Settings > Secrets
2. Add `MexcApiKey` and `MexcApiSecret` for `prod` environment

## Observability

- **Structured Logs**: Pino logger with request IDs
- **Metrics**: Encore metrics endpoints for latency, queue depth
- **Tracing**: Encore distributed tracing enabled
- **Alerts**: Cloud Logging integration for error tracking

## Database

Encore-managed PostgreSQL (`BotDB`) with Drizzle ORM:

- Migrations: `./migrations` directory
- Schema: Imported from `@mexc-sniperbot-ai/db`
- Backup: Point-in-time restore via Encore Cloud

## Contributing

See main repository README for contribution guidelines.

## License

See main repository LICENSE file.
