# Feature Specification: Encore Trading Refactor

**Feature Branch**: `[001-encore-refactor]`  
**Created**: 2025-11-13  
**Status**: Draft  
**Input**: User description: "@[/speckit.specify] use @[/Users/cortex-air/Developer/mexc-sniperbot-ai/.claude/encore_ts_llm_instructions.txt]  and lets refactor to use encore.dev in typescript use the tools to research"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch & configure Encore bot (Priority: P1)

Operations engineers need to authenticate into the Control Panel, select an Encore environment, provide start parameters (budget, symbols, recvWindow, safety switches), and issue start/stop commands that reach the Encore backend instantly so they can react to listings without SSH access.

**Why this priority**: Without a reliable start/stop surface the bot cannot be governed, making every other capability unusable.

**Independent Test**: From a clean environment, an operator can log in, persist a configuration preset, start the bot, and see authoritative confirmation that the Encore workflow accepted the command and stored the configuration snapshot.

**Acceptance Scenarios**:

1. **Given** the user has valid credentials, **When** they submit a start command with required fields, **Then** the Encore API acknowledges within 2 seconds and records a `BotRun` entry linked to the active configuration.
2. **Given** the bot is running, **When** the user hits Stop, **Then** the Control Panel updates to "Stopped" within 5 seconds and no new trades are attempted afterwards.

---

### User Story 2 - Detect & execute listings (Priority: P2)

The backend must continuously poll MEXC calendar and ticker feeds, validate listing signals, and execute MARKET buys through the mexc-api-sdk inside Encore workflows so the bot can snipe first fills with deterministic, logged execution.

**Why this priority**: Signal and execution velocity decide profitability; missing a listing renders the system pointless.

**Independent Test**: With mock MEXC responses, the scanner detects a synthetic listing, enqueues it, the trader workflow places a MARKET order using quoteOrderQty, and the order plus resulting position are persisted with timestamps for post-trade analysis.

**Acceptance Scenarios**:

1. **Given** the scanner receives a new listing payload, **When** validation passes, **Then** the trade executor is invoked within 500 ms and records a pending trade event.
2. **Given** a MARKET order response from MEXC, **When** the Encore workflow completes, **Then** the ledger writes the trade log and tagging metadata before acknowledging success to upstream services.

---

### User Story 3 - Observe, audit & tune (Priority: P3)

Risk owners require dashboards showing live positions, historical trade logs, throttling alerts, and configuration drift so they can prove compliance and adjust guardrails without redeploying.

**Why this priority**: Visibility keeps the bot operable in production environments with strict governance.

**Independent Test**: With the bot running, the UI polls Encore every 5 seconds, renders the latest trades, highlights constraint breaches, and allows exporting logs for audit in a single click.

**Acceptance Scenarios**:

1. **Given** at least one trade exists, **When** the UI polling cycle runs, **Then** the page refreshes with the new trade and latency badges without requiring manual refresh.
2. **Given** risk thresholds (e.g., max trades/hour) are exceeded, **When** Encore raises the event, **Then** the dashboard surfaces a red banner and the API exposes the same status for programmatic consumption.

---

### Edge Cases

- MEXC API throttles or returns HTTP 429; system must back off and surface degraded mode while retaining queued listings.
- Secrets (API key/secret) are missing or rotated mid-run; Control Panel must block execution and prompt re-validation before resuming.
- Bot is deployed in a region with >100 ms RTT to MEXC; detection-to-trade pipeline must still respect recvWindow and abort stale orders.
- Encore database migration fails; bot should not start and should display actionable error output.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide a secure Control Panel workflow where authenticated users can create, version, and apply bot configurations (symbols, quote spend, latency budget, safety switches) before issuing commands.
- **FR-002**: Integrate Encore's secrets manager so the bot never reads plaintext MEXC credentials from source control and validates presence before execution.
- **FR-003**: Implement a listing scanner service that polls MEXC calendar and ticker feeds with configurable intervals, deduplicates symbols, and emits validated listing events into the trader workflow queue.
- **FR-004**: Build an Encore trader workflow that calls the mexc-api-sdk MARKET order endpoint using quoteOrderQty, enforces recvWindow ≤ 1000 ms, and retries failures with exponential backoff capped at 2 attempts.
- **FR-005**: Persist every trade attempt, position update, and configuration snapshot to the Encore-managed PostgreSQL database with immutable timestamps for auditability.
- **FR-006**: Expose read APIs (expose: true) that power the Next.js dashboard via 5-second polling intervals without requiring websockets, including filters for time range and status.
- **FR-007**: Emit operational metrics (latency, success rate, throttling events) and alerts so operators can detect degradation before it affects executions.
- **FR-008**: Enforce safety constraints (max trades per hour, spend caps, concurrent listings) that block new orders and notify operators when thresholds are exceeded.

### Key Entities *(include if feature involves data)*

- **BotConfiguration**: Operator-defined presets containing symbols, spend limits, rate limits, safety switches, and metadata about the Encore environment.
- **BotRun**: A lifecycle record linking a configuration to a start/stop command, current status, heartbeat timestamps, and owning operator.
- **ListingSignal**: Normalized payload from calendar/ticker feeds including detection source, confidence, and freshness deadline used to gate orders.
- **TradeOrder**: Representation of a single buy/sell attempt with quote amount, recvWindow, order status, execution metrics, and linked ListingSignal.
- **TradeLog**: Ledger entries persisted post-execution containing exchange response, fill quantity, and references for dashboards/export.
- **SecretCredential**: Logical pointer to Encore-managed secrets with validation timestamp and environment scope.

### Assumptions

- System deploys Encore backend in a low-latency region (Tokyo/Singapore) per MEXC guidance.
- Operators manage identities externally; the Control Panel trusts an existing SSO/OIDC provider for authentication.
- Only spot listings are in scope for this release; futures support is out-of-scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Start/stop commands complete (including persistence and status broadcast) within 2 seconds 95% of the time.
- **SC-002**: Listing detection to MARKET order submission stays below 1 second median and below 2 seconds at the 95th percentile.
- **SC-003**: Dashboard polling delivers refreshed trade data within 5 seconds of a completed order with ≥99% success over a 1-hour window.
- **SC-004**: Safety constraints prevent >0 unauthorized trades per week by rejecting commands once configured thresholds are reached and logging the event.
