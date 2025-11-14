# Data Model: Encore Trading Refactor

## Core Entities

### BotConfiguration
**Purpose**: Operator-defined presets for bot execution parameters

**Fields**:
- `id` (string, PK): Unique identifier (UUID)
- `name` (string, required): Human-readable label for the configuration
- `symbols` (string[], required): List of trading pairs to monitor (e.g., ["BTCUSDT", "ETHUSDT"])
- `quoteAmount` (number, required): USDT spend per trade
- `maxTradesPerHour` (number, required): Rate limit constraint
- `maxDailySpend` (number, required): Total daily quote currency cap
- `recvWindow` (number, required): MEXC request validity window in ms (≤1000)
- `safetyEnabled` (boolean, default true): Master switch for constraint enforcement
- `createdAt` (timestamp): Record creation time
- `updatedAt` (timestamp): Last modification time
- `createdBy` (string): Operator identifier

**Validation**:
- `quoteAmount` > 0
- `maxTradesPerHour` > 0, ≤100
- `recvWindow` ≤ 1000
- `symbols` must be valid MEXC trading pairs

**State Transitions**: Immutable after creation; versioning handled by creating new configs

---

### BotRun
**Purpose**: Lifecycle record linking configuration to start/stop commands

**Fields**:
- `id` (string, PK): Unique run identifier
- `configurationId` (string, FK → BotConfiguration): Applied configuration snapshot
- `status` (enum, required): `starting` | `running` | `stopping` | `stopped` | `failed`
- `startedAt` (timestamp): Command timestamp
- `stoppedAt` (timestamp, nullable): Termination timestamp
- `lastHeartbeat` (timestamp): Latest health check
- `operatorId` (string): Who issued the command
- `errorMessage` (string, nullable): Failure reason if status=failed

**Validation**:
- `status` transitions: starting → running → stopping → stopped OR starting → failed
- `startedAt` < `stoppedAt` if stopped

**State Transitions**:
```
starting → running (on successful initialization)
running → stopping (on stop command)
stopping → stopped (on graceful shutdown)
starting/running → failed (on unrecoverable error)
```

---

### ListingSignal
**Purpose**: Normalized payload from calendar or ticker detection

**Fields**:
- `id` (string, PK): Unique signal identifier
- `symbol` (string, required): Trading pair (e.g., "NEWUSDT")
- `detectionSource` (enum, required): `calendar` | `ticker_diff`
- `detectedAt` (timestamp, required): UTC detection time
- `listingTime` (timestamp, nullable): Scheduled launch (calendar only)
- `confidence` (enum): `high` | `medium` | `low`
- `freshnessDeadline` (timestamp): After this, signal is stale
- `processed` (boolean, default false): Whether enqueued for trading

**Validation**:
- `symbol` matches MEXC pair format
- `freshnessDeadline` > `detectedAt`

**State Transitions**:
```
processed: false → true (on workflow enqueue)
```

---

### TradeOrder
**Purpose**: Single buy/sell attempt with execution metadata

**Fields**:
- `id` (string, PK): Order attempt identifier
- `runId` (string, FK → BotRun): Originating bot run
- `signalId` (string, FK → ListingSignal): Triggering signal
- `symbol` (string, required): Trading pair
- `side` (enum, required): `buy` | `sell`
- `orderType` (enum, required): `market` | `limit`
- `quoteAmount` (number, required for buy): USDT spend
- `quantity` (number, required for sell): Base asset amount
- `recvWindow` (number, required): Request validity window
- `status` (enum, required): `pending` | `submitted` | `filled` | `rejected` | `failed`
- `submittedAt` (timestamp): When sent to MEXC
- `completedAt` (timestamp, nullable): When final status received
- `executedPrice` (number, nullable): Fill price
- `executedQuantity` (number, nullable): Actual filled amount
- `mexcOrderId` (string, nullable): Exchange order ID
- `errorCode` (string, nullable): MEXC error code if rejected/failed
- `latencyMs` (number, nullable): Detection → submission time

**Validation**:
- `quoteAmount` > 0 OR `quantity` > 0 (not both)
- `recvWindow` ≤ 1000
- `submittedAt` < `completedAt` if completed

**State Transitions**:
```
pending → submitted → filled (success path)
pending → submitted → rejected (MEXC rejects)
pending → failed (workflow error before submission)
```

---

### TradeLog
**Purpose**: Immutable ledger entry post-execution for auditing

**Fields**:
- `id` (string, PK): Log entry identifier
- `orderId` (string, FK → TradeOrder): Referenced order
- `exchangeResponse` (jsonb, required): Full MEXC API response
- `fillQuantity` (number): Final filled amount
- `fillPrice` (number): Average fill price
- `fees` (jsonb): Trading fees breakdown
- `loggedAt` (timestamp, required): Entry creation time
- `positionSnapshot` (jsonb, nullable): Portfolio state after trade

**Validation**:
- Immutable; no updates allowed after insert
- `loggedAt` ≥ order `completedAt`

---

### SecretCredential
**Purpose**: Logical pointer to Encore-managed secrets

**Fields**:
- `id` (string, PK): Credential set identifier
- `environment` (enum, required): `local` | `dev` | `prod`
- `validatedAt` (timestamp, nullable): Last successful MEXC auth check
- `lastError` (string, nullable): Most recent validation failure

**Validation**:
- Secrets themselves stored in Encore secrets manager, not DB
- Only metadata persisted here

**State Transitions**:
```
validatedAt updated on successful MEXC ping
lastError cleared on validation success
```

---

## Relationships

- **BotRun** → **BotConfiguration** (many-to-one): Each run references a single config
- **TradeOrder** → **BotRun** (many-to-one): Orders belong to a run
- **TradeOrder** → **ListingSignal** (many-to-one): Orders triggered by signals
- **TradeLog** → **TradeOrder** (one-to-one): Each order has one immutable log entry
- **ListingSignal** → **TradeOrder** (one-to-many): A signal may spawn multiple orders (retry logic)

## Indexes

- `BotRun.status, BotRun.lastHeartbeat` (monitoring queries)
- `ListingSignal.processed, ListingSignal.freshnessDeadline` (unprocessed signals scan)
- `TradeOrder.status, TradeOrder.submittedAt` (dashboard filters)
- `TradeLog.loggedAt` (audit log pagination)

## Migration Strategy

Reuse existing Drizzle migrations in `packages/db` where compatible. Add Encore-specific tables via new migration files prefixed with `encore_`. Encore's SQLDatabase will reference the same migration folder.
