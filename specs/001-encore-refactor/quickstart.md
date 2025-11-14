# Quickstart: Encore Trading Refactor

## Integration Scenarios

### Scenario 1: Operator starts bot with existing configuration

**Prerequisites**:
- Valid MEXC credentials stored in Encore secrets
- At least one BotConfiguration exists
- Bot is not currently running

**Steps**:
1. Operator logs into Control Panel
2. Selects configuration from dropdown (UI polls `/configurations`)
3. Clicks "Start Bot" button
4. UI calls `POST /bot/start` with `configurationId`
5. Encore backend:
   - Validates configuration exists
   - Checks no other run is active
   - Creates BotRun record with status=`starting`
   - Initializes listing scanner cron job
   - Returns `runId` and status
6. UI polls `GET /bot/status` every 5 seconds
7. Dashboard displays "Running" with heartbeat timestamp

**Expected Outcome**:
- BotRun created with status=`running` within 2 seconds
- Scanner begins polling MEXC calendar API
- Dashboard shows green "Active" indicator

**Validation**:
- Query `BotRun` table: status should be `running`
- Check Encore metrics: `bot.start.latency` < 2000 ms
- Verify no error logs in Cloud Logging

---

### Scenario 2: Bot detects listing and executes trade

**Prerequisites**:
- Bot is running with valid configuration
- MEXC calendar returns new listing payload OR ticker diff detects new symbol

**Steps**:
1. Scanner service polls MEXC every 5 seconds
2. New listing detected for symbol "NEWUSDT"
3. Scanner creates `ListingSignal` record:
   - symbol: "NEWUSDT"
   - detectionSource: `calendar`
   - detectedAt: current timestamp
   - freshnessDeadline: detectedAt + 10 seconds
4. Listing enqueued to Encore workflow queue
5. Trader workflow:
   - Validates signal freshness
   - Checks safety constraints (trades/hour, daily spend)
   - Calls `mexc-api-sdk` with MARKET buy order
   - Sets recvWindow=1000, quoteOrderQty from config
6. MEXC returns order filled response
7. Workflow creates `TradeOrder` (status=`filled`) and `TradeLog`
8. Dashboard poll picks up new trade within 5 seconds

**Expected Outcome**:
- Signal → order submission < 1 second median
- Order filled and logged in PostgreSQL
- Dashboard displays trade with latency badge

**Validation**:
- Check `TradeOrder.latencyMs` < 1000 ms
- Verify `TradeLog.exchangeResponse` contains MEXC JSON
- Confirm safety counters incremented (trades/hour)

---

### Scenario 3: Safety constraint prevents trade

**Prerequisites**:
- Bot running with maxTradesPerHour=10
- Bot has already executed 10 trades in current hour

**Steps**:
1. New listing signal arrives
2. Trader workflow checks safety constraints
3. Detects `tradesThisHour >= maxTradesPerHour`
4. Workflow aborts before calling mexc-api-sdk
5. Creates `TradeOrder` with status=`rejected`, errorCode=`SAFETY_CONSTRAINT`
6. Logs event to structured logging (Pino)
7. Dashboard polls status, surfaces red banner: "Rate limit reached"

**Expected Outcome**:
- No MEXC API call made
- Trade blocked with auditable reason
- Operator notified via dashboard alert

**Validation**:
- Query `TradeOrder` WHERE status=`rejected` AND errorCode=`SAFETY_CONSTRAINT`
- Verify MEXC order count unchanged
- Check logs contain constraint violation event

---

### Scenario 4: Operator exports audit logs

**Prerequisites**:
- Multiple trades exist spanning several days
- Operator needs compliance report

**Steps**:
1. Operator navigates to "Audit" page in Control Panel
2. Selects date range (e.g., last 30 days)
3. Clicks "Export CSV"
4. UI calls `GET /trades/export?startDate=...&endDate=...`
5. Encore backend:
   - Queries `TradeLog` table with date filters
   - Generates CSV with columns: timestamp, symbol, side, quantity, price, fees
   - Streams response as `text/csv`
6. Browser downloads file `trades_2025-11-13.csv`

**Expected Outcome**:
- CSV contains all trades in date range
- File downloads within 5 seconds for up to 10,000 trades
- Data matches PostgreSQL records exactly

**Validation**:
- Open CSV in Excel/Numbers
- Spot-check 5 random rows against `TradeLog` table
- Verify row count matches query result

---

### Scenario 5: Bot restarts after crash

**Prerequisites**:
- Bot was running with active BotRun
- Compute instance restarts (Encore handles orchestration)

**Steps**:
1. Encore runtime detects crash
2. On restart, queries `BotRun` table for status=`running`
3. If found, updates status to `failed`, sets errorMessage
4. Control Panel polling detects status change
5. Operator sees "Failed" status with timestamp
6. Operator reviews logs, fixes issue (e.g., rotates secrets)
7. Operator starts bot again with fresh configuration

**Expected Outcome**:
- Failed run properly marked in DB
- No orphaned "running" status
- Clean restart without stale state

**Validation**:
- Query `BotRun` WHERE status=`failed`
- Check errorMessage contains crash reason
- Verify new run has different runId

---

## Environment Setup

### Local Development
```bash
# Install Encore CLI
curl -L https://encore.dev/install.sh | bash

# Set local secrets
encore secret set --type local MexcApiKey "your-key"
encore secret set --type local MexcApiSecret "your-secret"

# Run Encore backend
cd packages/api
encore run

# In another terminal, run Next.js UI
cd apps/web
bun run dev
```

### Production Deployment
```bash
# Deploy Encore backend to Tokyo region
encore deploy --cloud-provider aws --region ap-northeast-1

# Deploy Next.js to Vercel
cd apps/web
vercel deploy --prod

# Set production secrets via Encore Cloud dashboard
# Navigate to Settings > Secrets, add MexcApiKey and MexcApiSecret
```

## Testing Strategy

**Unit Tests**: Encore test runner for workflows, Vitest for shared utils  
**Contract Tests**: Validate OpenAPI specs against generated Encore endpoints  
**Integration Tests**: Playwright for Control Panel flows (start, stop, export)  
**Performance Tests**: Load test `/bot/status` endpoint (target: 100 req/s sustained)
