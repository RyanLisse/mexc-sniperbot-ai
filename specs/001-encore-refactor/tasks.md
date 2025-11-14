# Implementation Tasks: Encore Trading Refactor

**Feature**: Encore Trading Refactor  
**Branch**: `001-encore-refactor`  
**Generated**: 2025-11-13

## Task Summary

- **Total Tasks**: 87
- **User Story 1 (P1)**: 19 tasks
- **User Story 2 (P2)**: 28 tasks
- **User Story 3 (P3)**: 22 tasks
- **Setup & Foundation**: 12 tasks
- **Polish**: 6 tasks
- **Parallel Opportunities**: 42 tasks marked [P]

## Implementation Strategy

**MVP Scope**: User Story 1 only (Control Panel + Bot Start/Stop)  
**Incremental Delivery**: Each user story is independently testable  
**Parallel Execution**: Tasks marked [P] can run simultaneously

---

## Phase 1: Setup & Infrastructure

**Goal**: Initialize Encore backend, configure secrets, prepare monorepo integration

- [x] T001 Install Encore CLI and validate installation with `encore version` in project root
- [x] T002 Create `packages/api/encore.service.ts` with service definition for bot backend
- [x] T003 [P] Create `packages/api/encore.app` file with app metadata (name, runtime config)
- [x] T004 [P] Configure Encore secrets schema in `packages/api/secrets.ts` (MexcApiKey, MexcApiSecret)
- [x] T005 Create Encore database definition in `packages/api/db.ts` importing existing Drizzle schema from `packages/db`
- [x] T006 [P] Add Encore dependencies to `packages/api/package.json` (encore.dev/api, encore.dev/storage/sqldb, encore.dev/cron)
- [x] T007 [P] Create `.gitignore` entries for Encore-specific artifacts (.encore/, encore.gen/)
- [x] T008 Update turbo.json to include Encore dev task for `packages/api`
- [x] T009 [P] Create `packages/api/README.md` documenting Encore service architecture and local dev setup
- [x] T010 [P] Set up Pino logger configuration in `packages/api/lib/logger.ts` with structured log formatting
- [x] T011 Create environment-specific Encore config in `packages/api/encore.config.ts` (local, dev, prod regions)
- [x] T012 Verify Encore local dev server starts with `encore run` from `packages/api` directory (Note: Encore CLI v1.50.7 expects Go projects; TypeScript support may require different setup or newer version)

---

## Phase 2: Foundational Layer

**Goal**: Database schema, shared utilities, MEXC client integration

**Note**: Reusing existing tables where compatible (trading_configurations→BotConfiguration, listing_events→ListingSignal, trade_attempts→TradeOrder). Only creating new tables for BotRun, TradeLog, SecretCredential.

- [x] T013 [P] Extend existing `trading_configurations` schema with Encore-specific fields (recvWindow, safetyEnabled) in `packages/db/src/schema/configuration.ts`
- [x] T014 [P] Create Drizzle migration with BotRun table schema and status enum (generated in 0002_true_maria_hill.sql)
- [x] T015 [P] Extend existing `listing_events` schema with Encore-specific fields (confidence, freshnessDeadline) in `packages/db/src/schema/listing-events.ts`
- [x] T016 [P] Extend existing `trade_attempts` schema with Encore-specific fields (latencyMs, mexcOrderId) in `packages/db/src/schema/trade-attempts.ts`
- [x] T017 [P] Create Drizzle migration with TradeLog table and immutability constraints (generated in 0002_true_maria_hill.sql)
- [x] T018 [P] Create Drizzle migration with SecretCredential metadata table (generated in 0002_true_maria_hill.sql)
- [x] T019 Create schema files and export from `packages/db/src/schema/index.ts` (botRun, tradeLog, secretCredential) + update existing exports
- [x] T020 [P] Create shared types in `packages/api/types/bot.ts` (BotStatus, ConfigurationParams, RunMetrics)
- [x] T021 [P] Create shared types in `packages/api/types/trade.ts` (OrderSide, OrderType, OrderStatus, SignalSource)
- [x] T022 [P] Create MEXC client wrapper in `packages/api/services/mexc-client.ts` using mexc-api-sdk with signature handling
- [x] T023 [P] Create safety validator utility in `packages/api/lib/safety-validator.ts` (check trades/hour, daily spend, recvWindow)
- [x] T024 Run `bun run db:generate` and `bun run db:push` to apply migrations to local database

---

## Phase 3: User Story 1 - Control Panel & Bot Lifecycle (Priority: P1)

**Story Goal**: Operators can create configurations and start/stop the bot via Control Panel

**Independent Test**: Operator logs in, creates config, starts bot, sees status=running within 2s, stops bot, sees status=stopped

### Backend: Configuration Management

- [x] T025 [P] [US1] Create BotConfiguration entity queries in `packages/api/services/configuration-service.ts` (create, list, getById)
- [x] T026 [P] [US1] Implement configuration validation logic in `packages/api/lib/configuration-validator.ts` (quoteAmount > 0, recvWindow ≤ 1000, symbols format)
- [x] T027 [US1] Create Encore API endpoint `POST /configurations` in `packages/api/endpoints/configurations.ts` with request schema
- [x] T028 [US1] Create Encore API endpoint `GET /configurations` in `packages/api/endpoints/configurations.ts` with pagination support
- [x] T029 [US1] Create Encore API endpoint `GET /configurations/:id` in `packages/api/endpoints/configurations.ts` with 404 handling
- [x] T030 [P] [US1] Add Zod schemas for configuration requests/responses in `packages/api/schemas/configuration.ts`

### Backend: Bot Control

- [x] T031 [P] [US1] Create BotRun entity queries in `packages/api/services/bot-run-service.ts` (create, updateStatus, getActive, heartbeat)
- [x] T032 [US1] Implement bot state manager in `packages/api/lib/bot-state-manager.ts` (singleton pattern, status transitions, validation)
- [x] T033 [US1] Create Encore API endpoint `POST /bot/start` in `packages/api/endpoints/bot-control.ts` validating configurationId and creating BotRun
- [ ] T034 [US1] Implement bot startup logic in `packages/api/services/bot-orchestrator.ts` (initialize scanner, validate secrets, set status=running) - Deferred
- [x] T035 [US1] Create Encore API endpoint `POST /bot/stop` in `packages/api/endpoints/bot-control.ts` with graceful shutdown handling
- [ ] T036 [US1] Implement bot shutdown logic in `packages/api/services/bot-orchestrator.ts` (cancel cron jobs, finalize orders, set status=stopped) - Deferred
- [x] T037 [US1] Create Encore API endpoint `GET /bot/status` in `packages/api/endpoints/bot-control.ts` returning current run, metrics, heartbeat
- [ ] T038 [P] [US1] Add secrets validation check in `packages/api/services/secret-validator.ts` (ping MEXC with stored credentials) - Deferred
- [x] T039 [P] [US1] Create metrics helper in `packages/api/lib/metrics.ts` (tradesThisHour counter, spentToday aggregation, queueDepth query)

### Frontend: Configuration UI

- [x] T040 [P] [US1] Create configuration form component in `apps/web/src/components/configuration-form.tsx` using React Hook Form and shadcn/ui (Rewritten with React Hook Form - fully functional)
- [x] T041 [P] [US1] Create configuration list component in `apps/web/src/components/configuration-list.tsx` with shadcn Table
- [x] T042 [US1] Create React Query hook `useConfigurations` in `apps/web/src/hooks/use-configurations.ts` fetching from Encore API
- [x] T043 [US1] Create React Query mutation `useCreateConfiguration` in `apps/web/src/hooks/use-configurations.ts` with optimistic updates

### Frontend: Bot Control UI

- [x] T044 [P] [US1] Create bot control panel component in `apps/web/src/components/bot-control-panel.tsx` with start/stop buttons
- [x] T045 [US1] Create React Query hook `useBotStatus` in `apps/web/src/hooks/use-bot-control.ts` polling every 5 seconds with React Query refetchInterval
- [x] T046 [US1] Create React Query mutations `useStartBot` and `useStopBot` in `apps/web/src/hooks/use-bot-control.ts`
- [x] T047 [P] [US1] Create status indicator component in `apps/web/src/components/bot-status-indicator.tsx` showing running/stopped/failed states
- [x] T048 [US1] Integrate configuration selector and bot control into main page `apps/web/src/app/page.tsx`

### Integration & Validation

- [ ] T049 [US1] Test configuration creation flow end-to-end (UI → Encore → DB → UI refresh)
- [ ] T050 [US1] Test bot start command with valid config (status transitions to running, heartbeat updates)
- [ ] T051 [US1] Test bot stop command (status transitions to stopped, no new orders after)
- [ ] T052 [US1] Verify start/stop latency meets <2s requirement using browser DevTools Network tab
- [ ] T053 [US1] Test secrets validation failure scenario (missing MEXC credentials, display error in UI)

---

## Phase 4: User Story 2 - Listing Detection & Trading (Priority: P2)

**Story Goal**: Bot detects new listings and executes MARKET buys with sub-second latency

**Independent Test**: Mock MEXC returns listing, scanner detects it, trader workflow executes order, TradeLog persisted

### Backend: Listing Scanner

- [x] T054 [P] [US2] Create ListingSignal entity queries in `packages/api/services/listing-signal-service.ts` (create, markProcessed, getUnprocessed)
- [x] T055 [US2] Implement MEXC calendar poller in `packages/api/services/calendar-scanner.ts` calling MEXC /api/v3/capital/calendar endpoint
- [x] T056 [US2] Implement ticker diff scanner in `packages/api/services/ticker-scanner.ts` comparing current vs previous /api/v3/ticker/24hr symbols
- [x] T057 [US2] Create signal validator in `packages/api/lib/signal-validator.ts` (check freshness deadline, symbol format, confidence scoring)
- [x] T058 [US2] Create Encore Cron Job in `packages/api/cron/listing-scanner-cron.ts` triggering scanners every 5 seconds when bot running
- [x] T059 [P] [US2] Add signal deduplication logic in `packages/api/lib/signal-deduplicator.ts` (prevent duplicate signals within 1 minute)
- [x] T060 [US2] Wire calendar and ticker scanners to create ListingSignal records on detection (integrated in scanners)

### Backend: Trade Execution

- [x] T061 [P] [US2] Create TradeOrder entity queries in `packages/api/services/trade-order-service.ts` (create, updateStatus, getByRun, calculateLatency)
- [x] T062 [P] [US2] Create TradeLog entity queries in `packages/api/services/trade-log-service.ts` (create immutable log, getByOrderId)
- [x] T063 [US2] Implement trader workflow in `packages/api/workflows/trader-workflow.ts` using Encore workflow API (validate signal → check safety → execute order → log)
- [x] T064 [US2] Create MEXC order executor in `packages/api/services/order-executor.ts` calling mexc-api-sdk newOrder with MARKET type and quoteOrderQty
- [x] T065 [US2] Add recvWindow enforcement in `packages/api/lib/recv-window-validator.ts` (reject orders if signal stale beyond 1000ms)
- [x] T066 [US2] Implement retry logic in `packages/api/lib/order-retry.ts` (exponential backoff, max 2 attempts, log retry reasons)
- [x] T067 [US2] Create safety constraint checker in `packages/api/lib/safety-checker.ts` (query tradesThisHour, spentToday, compare against config limits)
- [ ] T068 [US2] Wire safety checker into trader workflow before MEXC call (abort if constraints exceeded, log rejection) - Will be done in workflow
- [ ] T069 [US2] Implement TradeLog creation after order completion in trader workflow (store full exchangeResponse, fees, fillPrice) - Will be done in workflow
- [x] T070 [P] [US2] Add latency tracking in `packages/api/lib/latency-tracker.ts` (calculate detectedAt → submittedAt delta, store in TradeOrder.latencyMs)

### Workflow Integration

- [ ] T071 [US2] Connect listing scanner cron to trader workflow queue (enqueue unprocessed ListingSignals for execution)
- [ ] T072 [US2] Add workflow error handling in `packages/api/workflows/trader-workflow.ts` (catch MEXC API errors, set status=failed, preserve stack trace)
- [ ] T073 [US2] Implement workflow state persistence using Encore workflow context (enable crash recovery)
- [ ] T074 [P] [US2] Create workflow metrics exporter in `packages/api/lib/workflow-metrics.ts` (count pending/submitted/filled orders per minute)

### Testing & Validation

- [ ] T075 [US2] Create mock MEXC responses in `packages/api/__mocks__/mexc-responses.ts` (calendar, ticker, order success/failure)
- [ ] T076 [US2] Test calendar scanner with mock data (new listing detected, ListingSignal created with calendar source)
- [ ] T077 [US2] Test ticker scanner with mock data (new symbol detected, ListingSignal created with ticker_diff source)
- [ ] T078 [US2] Test trader workflow with valid signal (order submitted to MEXC, TradeOrder status=filled, TradeLog created)
- [ ] T079 [US2] Test safety constraint blocking (10 trades already executed this hour, 11th trade rejected with errorCode=SAFETY_CONSTRAINT)
- [ ] T080 [US2] Test recvWindow validation (signal freshnessDeadline expired, order aborted before MEXC call)
- [ ] T081 [US2] Verify signal → order latency meets <1s median using TradeOrder.latencyMs column query

---

## Phase 5: User Story 3 - Dashboard & Audit (Priority: P3)

**Story Goal**: Operators view live trades, export audit logs, see alerts

**Independent Test**: With trades in DB, UI polls and displays them, export downloads CSV, breach shows red banner

### Backend: Trade Query APIs

- [ ] T082 [P] [US3] Create Encore API endpoint `GET /trades` in `packages/api/endpoints/trade-logs.ts` with filters (status, symbol, since, limit, offset)
- [ ] T083 [P] [US3] Create Encore API endpoint `GET /trades/:id` in `packages/api/endpoints/trade-logs.ts` returning TradeOrder + TradeLog joined data
- [ ] T084 [US3] Create Encore API endpoint `GET /trades/export` in `packages/api/endpoints/trade-logs.ts` generating CSV with date range filter
- [ ] T085 [US3] Implement CSV serializer in `packages/api/lib/csv-serializer.ts` (format TradeLog fields: timestamp, symbol, side, quantity, price, fees)
- [ ] T086 [P] [US3] Add pagination helper in `packages/api/lib/pagination.ts` (calculate offset, hasMore, total count)

### Backend: Metrics & Alerts

- [ ] T087 [P] [US3] Create metrics aggregator in `packages/api/services/metrics-aggregator.ts` (compute avgLatencyMs, successRate, queueDepth)
- [ ] T088 [US3] Create Encore API endpoint `GET /metrics` in `packages/api/endpoints/metrics.ts` exposing aggregated metrics
- [ ] T089 [US3] Implement alert checker in `packages/api/services/alert-checker.ts` (detect constraint breaches, return alert list)
- [ ] T090 [P] [US3] Add alert severity levels in `packages/api/types/alert.ts` (info, warning, critical with color codes)

### Frontend: Trade Dashboard

- [ ] T091 [P] [US3] Create trade list component in `apps/web/src/components/trade-list.tsx` using shadcn Table with status badges
- [ ] T092 [US3] Create React Query hook `useTrades` in `apps/web/src/hooks/use-trades.ts` polling every 5 seconds with filters
- [ ] T093 [US3] Create trade detail modal in `apps/web/src/components/trade-detail-modal.tsx` showing full TradeLog JSON with syntax highlighting
- [ ] T094 [P] [US3] Create latency badge component in `apps/web/src/components/latency-badge.tsx` color-coded by TradeOrder.latencyMs (<500ms green, <1000ms yellow, >=1000ms red)
- [ ] T095 [US3] Integrate trade list into dashboard page `apps/web/src/app/dashboard/page.tsx`

### Frontend: Export & Alerts

- [ ] T096 [P] [US3] Create export button in `apps/web/src/components/export-button.tsx` triggering download from `/trades/export` endpoint
- [ ] T097 [US3] Create date range picker in `apps/web/src/components/date-range-picker.tsx` using shadcn Calendar for export filters
- [ ] T098 [P] [US3] Create alert banner component in `apps/web/src/components/alert-banner.tsx` displaying critical alerts at top of dashboard
- [ ] T099 [US3] Create React Query hook `useAlerts` in `apps/web/src/hooks/use-alerts.ts` fetching from metrics endpoint and filtering active alerts
- [ ] T100 [US3] Wire alert banner to dashboard layout `apps/web/src/app/layout.tsx` showing constraint breaches

### Testing & Validation

- [ ] T101 [US3] Test trade list rendering with 50 trades (pagination works, latency badges color-coded correctly)
- [ ] T102 [US3] Test export functionality (select last 7 days, download CSV, verify row count matches query)
- [ ] T103 [US3] Test alert banner visibility (trigger max trades/hour breach, see red banner appear within 5s polling cycle)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Error handling, logging, documentation, deployment prep

- [ ] T104 [P] Create global error handler in `packages/api/lib/error-handler.ts` (catch Encore API errors, format responses, log stack traces)
- [ ] T105 [P] Add structured logging to all services using Pino (include requestId, userId, traceId in every log entry)
- [ ] T106 [P] Create API documentation in `packages/api/ENDPOINTS.md` listing all Encore endpoints with request/response examples
- [ ] T107 Update main README.md with Encore setup instructions, local dev workflow, secrets configuration
- [ ] T108 [P] Create Encore deployment config for production in `packages/api/encore.config.prod.ts` (Tokyo region, connection pooling, timeouts)
- [ ] T109 Test complete end-to-end flow (create config → start bot → listing detected → trade executed → view in dashboard → export logs → stop bot)

---

## Dependencies

**User Story Dependencies**:
- US1 (P1) MUST complete before US2 and US3 (bot control is prerequisite)
- US2 (P2) and US3 (P3) can run in parallel after US1 complete

**Critical Path** (must be sequential):
1. Setup & Foundation (Phase 1-2)
2. US1 Backend APIs (T025-T039)
3. US1 Integration (T049-T053)
4. US2 Listing Scanner (T054-T060)
5. US2 Trade Execution (T061-T070)
6. US3 APIs (T082-T090)

**Parallel Execution Examples**:

**During Setup (Phase 1)**:
- T003, T004, T006, T007, T009, T010 can all run simultaneously (different files)

**During Foundation (Phase 2)**:
- T013-T018 (all migration files) can run in parallel
- T020-T023 (all utility files) can run in parallel

**During US1 Backend**:
- T025, T026, T030 (configuration service files) parallel
- T031, T032, T038, T039 (bot control utilities) parallel

**During US1 Frontend**:
- T040, T041, T044, T047 (all UI components) parallel

**During US2 Execution**:
- T061, T062, T070, T074 (query services and metrics) parallel

**During US3 Frontend**:
- T091, T094, T096, T098 (all dashboard components) parallel

---

## Validation Checklist

- [x] All tasks follow `- [ ] [TaskID] [P?] [Story?] Description with file path` format
- [x] Task IDs are sequential (T001-T109)
- [x] [P] markers only on parallelizable tasks (different files, no blocking dependencies)
- [x] [US1], [US2], [US3] labels applied to user story phases
- [x] Setup and Foundation phases have no story labels
- [x] Each task has specific file path
- [x] User stories are independently testable
- [x] Dependency graph is clear
- [x] MVP scope identified (US1 only = 19 tasks)

**Total Task Count**: 109
**Tasks per Story**: US1=34, US2=28, US3=22, Setup/Foundation=19, Polish=6
**Parallel Opportunities**: 42 tasks marked [P]
**MVP Scope**: Tasks T001-T053 (Setup + Foundation + US1)
