# 🚀 MEXC Sniperbot-AI: Unified Product & Execution Blueprint

## 🎯 Vision

Build a **real-time, latency-optimized crypto sniping bot** that monitors MEXC for new listings, executes trades within 100ms, and provides a live dashboard. Use Bun, Next.js 16, tRPC, Supabase, Effect-TS, and Mastra for AI orchestration and reliability.

---

## 🧩 Architecture Summary

| Layer            | Technology                                  | Purpose                                                           |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| Frontend         | Next.js 16, TanStack Query                  | Dashboard (trade logs, bot config, health, listing alerts)        |
| Backend          | Bun, tRPC, Drizzle ORM, Effect-TS          | API, DB access, background loops, error handling                  |
| Infra            | Supabase (Postgres), Redis, TimescaleDB     | Persistence, event caching, time-series trade logs                |
| Trading Core     | WebSocket (10ms MEXC), REST w/HTTP2 pooling | Fast price feeds and execution via Protocol Buffers               |
| AI Orchestration | Mastra workflows, Zod validation            | Deterministic trade pipeline with retry, suspension, snapshotting  |
| Observability    | Prometheus, Grafana, Pino                   | Metrics, logging, monitoring, audit trails                         |
| Dev/CI/CD        | Bun, Ultracite, Qlty, Jest, Docker Compose  | Type safety, code formatting, tests, deployments                   |

---

## 📘 PRD Highlights

### Core Features

* **WebSocket-based listing monitor** (10ms latency)
* **Auto-trade logic** with pre-validation, risk checks, fallback
* **Real-time dashboard**: status, trades, listing log
* **Mastra-orchestrated workflows**: safe, resumable, typed
* **Voice/Chat trading interface** (opt-in): NLP-powered confirmations
* **Safe deployment**: circuit breakers, rate limits, geo-optimized

### Non-Functionals

* ≤100ms order latency (goal: ≤80ms with pooling + geo-routing)
* 99.9% uptime, crash-resilient via state snapshots
* 80%+ test coverage, comprehensive audit logging
* 10,000 market updates/sec handling capacity

---

## 🧱 Combined Vertical Slicing Implementation Plan

| Phase                     | Deliverable                                                                             | Key Tools                         | Validation                               |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| 1. Foundation             | `bun create better-t-stack` init, Supabase schema, Drizzle tables (`configs`, `snipes`) | Bun, Drizzle, Supabase, Ultracite | Project builds, types compile            |
| 2. MEXC API Client        | REST (with pooling), WebSocket (Protocol Buffers, 10ms subs), order signer              | axios+HTTP2 agent, ws, protobuf  | GET `/ping`, WS reconnects, /order posts |
| 3. Sniper Engine          | Continuous listing scanner (calendar endpoint fallback), trigger Mastra workflow        | Effect-TS, Mastra, retry logic   | Detect 1+ listing, fire dry-run order    |
| 4. Order Pipeline         | Mastra `order-execution` pipeline: validate → risk-check → execute → confirm             | Zod, Mastra, exchange SDK         | Order passes workflow or suspends        |
| 5. State + Storage        | Persist trades, snapshots, portfolio states                                             | Drizzle ORM, Redis, TimescaleDB  | Orders saved, restored on crash          |
| 6. Dashboard              | Next.js 16 UI: logs, active listings, configs; tRPC + TanStack for data                | TanStack Query, tRPC              | Live reload, config save                 |
| 7. Risk/Safety            | Rate limits (Bottleneck), breakers (Opossum), max PnL guardrails                        | Bottleneck, Opossum, Pino         | Stops >limit trades, logs faults         |
| 8. Testing                | Jest, `jest-websocket-mock`, integration + latency tests                                | Bun test, ts-jest                 | 80%+ coverage, P95<100ms                 |
| 9. Monitoring             | /metrics endpoint, Prometheus scrape, Grafana dash, alerts                              | prom-client, Grafana              | Live metrics on order latencies          |
| 10. Voice/Chat (Optional) | Socket.io command input, Deepgram/Azure voice → NLP → Mastra                            | Deepgram, Socket.io, Claude3      | Trade via chat/voice confirmed           |
| 11. CI/CD                 | GitHub Actions: test, build, Docker deploy to VPS or fly.io                            | docker-compose, actions, Secrets  | Image deploys from main                  |
| 12. Polishing              | Lint (Qlty), coverage gating, Next.js 16 caching flags                                  | Qlty, Ultracite, Husky            | PRs pass quality gates                   |

---

## ⚙️ Optimizations Applied

| Area               | Technique                                       | Impact         |
| ------------------ | ----------------------------------------------- | -------------- |
| Network Latency    | HTTP/2 keep-alive, WS reconnects, local deploy  | -150ms RTT     |
| Execution Failures | Mastra retries, circuit breakers, fallback APIs | ↑ stability    |
| Trading Accuracy   | Client-side pre-validation, cache filters       | -100ms reject  |
| Throughput         | LRU + Redis dual cache, WS batching             | 10k+ updates/s |
| Memory/GC          | TypedArrays, object reuse                       | -GC spikes     |

---

## 🛡️ Security & Safety

* ✅ API key storage via Secrets Manager or Supabase vault
* ✅ All order flows enforce risk checks: max position %, loss thresholds
* ✅ Commands gated: MFA or confirmation for $500+ trades
* ✅ Circuit breakers for REST; rate limiting for all MEXC traffic
* ✅ Trade logs redacted and persisted via Pino JSON logger

---

## 📈 Success Metrics

| Metric                    | Target               |
| ------------------------- | -------------------- |
| 🕒 P99 Order Latency      | < 100ms              |
| 📶 Market Update Rate     | 10k/sec handled      |
| ✅ Test Coverage           | ≥ 80%                |
| 🔁 Recovery Resilience    | Full resume-on-crash |
| 💰 Trade Limit Compliance | 100% adherence       |

---

## 🛠️ Tech Stack Details

### Frontend
- **Next.js 16** (React) with TypeScript, App Router, improved caching APIs
- **TanStack Query** for server state management and caching
- **tRPC** for end-to-end type-safe APIs

### Backend/API
- **Bun** runtime and package manager (~3× faster than Node)
- **tRPC** routers in Next.js API routes for type safety
- **Effect-TS** for robust async operations and error handling
- **Mastra** for AI orchestration and workflow management

### Database & Storage
- **Supabase Postgres** for primary data persistence
- **Drizzle ORM** for type-safe database access
- **Redis** for event caching and real-time state
- **TimescaleDB** (via Supabase) for time-series trade logs

### Trading Infrastructure
- **MEXC REST API** with HTTP/2 pooling and keep-alive
- **MEXC WebSocket** with Protocol Buffers for 10ms latency
- **HMAC SHA256** signing for authenticated requests

### Observability
- **Prometheus** for metrics collection
- **Grafana** for visualization and dashboards
- **Pino** for structured JSON logging
- **OpenTelemetry** (via Effect-TS) for distributed tracing

### Development Tools
- **Ultracite** (Biome preset) for zero-config formatting/linting
- **Qlty CLI** for multi-language linting and formatting
- **Jest** for unit and integration testing
- **Docker Compose** for local development and deployment
- **GitHub Actions** for CI/CD

### Optional Features
- **Deepgram/Azure** for voice input processing
- **Claude3** for NLP-powered command interpretation
- **Socket.io** for real-time chat interface

---

## 📋 Implementation Details

### Phase 1: Foundation
1. Initialize monorepo with `bun create better-t-stack@latest mexc-sniperbot-ai`
2. Configure Ultracite: `npx ultracite init`
3. Set up Qlty CLI in CI/CD pipeline
4. Verify Next.js 16 upgrade with cache components flag
5. Configure Supabase connection and Drizzle setup
6. Create initial schema: `configs`, `snipes`, `trade_logs`, `bot_state`

### Phase 2: MEXC API Client
1. Implement REST client with HTTP/2 agent and connection pooling
2. Build WebSocket client with Protocol Buffers support
3. Implement HMAC SHA256 request signing
4. Add reconnection logic with exponential backoff
5. Test connectivity: `/ping`, server time, exchange info

### Phase 3: Sniper Engine
1. Create Effect-TS background loop for continuous scanning
2. Implement listing detection via WebSocket (primary) and calendar endpoint (fallback)
3. Trigger Mastra workflow on new listing detection
4. Add retry logic with Effect-TS error handling
5. Validate detection within 100ms target

### Phase 4: Order Pipeline (Mastra)
1. Define Mastra workflow: `order-execution` with steps:
   - Validate order parameters (Zod)
   - Risk checks (max position, loss thresholds)
   - Execute order via MEXC API
   - Confirm execution and update state
2. Implement workflow suspension/resumption for crash recovery
3. Add snapshotting for state persistence
4. Test workflow end-to-end with dry-run orders

### Phase 5: State & Storage
1. Persist trades to Drizzle ORM (Supabase Postgres)
2. Implement Redis caching for real-time state
3. Set up TimescaleDB for time-series trade logs
4. Add state restoration on crash recovery
5. Test persistence and recovery scenarios

### Phase 6: Dashboard
1. Build Next.js 16 pages: Dashboard, Live Listings, Settings
2. Implement tRPC routers: `getRecentTrades`, `getConfig`, `updateConfig`, `getNewListings`
3. Use TanStack Query for data fetching and caching
4. Add real-time updates via WebSocket or polling
5. Display bot status, trade logs, active listings

### Phase 7: Risk & Safety
1. Integrate Bottleneck for rate limiting
2. Add Opossum circuit breakers for REST API calls
3. Implement max PnL guardrails and position limits
4. Add MFA/confirmation for high-value trades ($500+)
5. Log all risk events via Pino

### Phase 8: Testing
1. Write unit tests with Bun test runner
2. Add integration tests with `jest-websocket-mock`
3. Create latency tests to validate P95 < 100ms
4. Achieve 80%+ test coverage
5. Add E2E tests for critical paths

### Phase 9: Monitoring
1. Expose `/metrics` endpoint with Prometheus format
2. Set up Prometheus scraping configuration
3. Create Grafana dashboards for:
   - Order latencies (P50, P95, P99)
   - Trade success rates
   - API error rates
   - Bot uptime
4. Configure alerts for critical metrics
5. Add audit trail logging

### Phase 10: Voice/Chat (Optional)
1. Set up Socket.io for real-time communication
2. Integrate Deepgram or Azure for voice input
3. Add Claude3 for NLP command interpretation
4. Create Mastra workflow for voice/chat trade execution
5. Add confirmation flows for safety

### Phase 11: CI/CD
1. Create GitHub Actions workflow:
   - Run tests on PR
   - Build Docker image
   - Deploy to staging/production
2. Set up secrets management for API keys
3. Configure Docker Compose for local development
4. Add deployment scripts for VPS or fly.io

### Phase 12: Polishing
1. Run Qlty CLI for final code quality checks
2. Ensure coverage gating (80%+)
3. Optimize Next.js 16 caching flags
4. Update documentation (README, API docs)
5. Final security audit

---

## 📚 References

1. [MEXC API Documentation](https://www.mexc.com/api-docs/spot-v3/introduction)
2. [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
3. [Bun Runtime](https://bun.com/)
4. [tRPC Documentation](https://trpc.io/)
5. [Drizzle ORM](https://supabase.com/docs/guides/database/drizzle)
6. [Supabase Platform](https://supabase.com/)
7. [TanStack Query](https://tanstack.com/query/v4/docs/framework/react/overview)
8. [Effect-TS](https://effect.website/)
9. [Ultracite](https://www.ultracite.ai/)
10. [Qlty CLI](https://qlty.sh/)
11. [MEXC General Info](https://www.mexc.com/api-docs/spot-v3/general-info)
12. [MEXC Market Data](https://www.mexc.com/api-docs/spot-v3/market-data-endpoints)

---

## 🎯 Next Steps

Would you like me to:

* Generate the full monorepo directory scaffold?
* Create the Drizzle schema and Mastra workflow config?
* Scaffold test suite and GitHub Actions pipeline?

Let me know where you'd like to start.
