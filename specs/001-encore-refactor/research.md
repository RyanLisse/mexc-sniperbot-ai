# Research: Encore Trading Refactor

## Decision Log

### Decision: Deploy Encore backend in ap-northeast-1 (Tokyo)
- **Rationale**: MEXC documentation recommends Japan/Singapore AWS regions for lowest latency. Tokyo offers sub-50 ms RTT from Encore compute to MEXC, keeping recvWindow under 1000 ms and ensuring calendar polling reacts within the 5 s budget.
- **Alternatives considered**:
  - **ap-southeast-1 (Singapore)**: Slightly higher latency to MEXC spot engine per vendor guidance; kept as DR region.
  - **us-west-2**: Would add >150 ms RTT, missing critical sniping windows.

### Decision: Use mexc-api-sdk Spot client for all authenticated calls
- **Rationale**: SDK handles HMAC signing, recvWindow, and rate-limit headers, reducing error-prone custom signing logic. Matches Encore.ts ethos of small, typed clients.
- **Alternatives considered**:
  - **Manual REST calls with fetch**: More control but duplicated auth logic and risk of drift with MEXC API changes.
  - **Community wrappers**: Lacked maintenance guarantees and TypeScript typings.

### Decision: Listing detection via dual-source polling (calendar + ticker diff)
- **Rationale**: Calendar feed gives scheduled listings; ticker diff catches surprise launches. Combining reduces missed opportunities and feeds the same workflow queue.
- **Alternatives considered**:
  - **Calendar only**: Would miss stealth drops.
  - **Websocket stream**: Not available for pre-listing signals; would add connection complexity.

### Decision: Persist trade + configuration history in Encore PostgreSQL with immutable records
- **Rationale**: Encore DB offers migrations, point-in-time restore, and co-location with compute. Immutable history supports audits and dashboards without data races.
- **Alternatives considered**:
  - **External Timescale/ClickHouse**: More analytics power but higher latency and operational overhead.
  - **In-memory store + periodic export**: Risk of data loss on failures.

### Decision: Control Panel uses polling (React Query) instead of websockets
- **Rationale**: Aligns with Encore reference architecture; avoids maintaining socket infra and simplifies SSR/hydration in Next.js 16. 5 s polling meets freshness needs.
- **Alternatives considered**:
  - **WebSockets**: Faster updates but overkill; Encore streaming APIs could be added later if metrics demand.
  - **Server-Sent Events**: Similar operational cost to websockets with limited incremental value.

### Decision: Safety constraints enforced before placing orders
- **Rationale**: Prevents runaway spend and ensures compliance. Implement guards (max trades/hour, quote caps, per-symbol concurrency) in Encore workflow before invoking mexc-api-sdk.
- **Alternatives considered**:
  - **Post-trade reconciliation**: Detects breaches too late.
  - **Manual operator overrides**: Error-prone and non-deterministic.

### Decision: Observability via structured logs + Encore metrics endpoints
- **Rationale**: Structured logs (Pino) feed Cloud logging. Encore exposes metrics for latency, queue depth, and throttle events; dashboards can poll these.
- **Alternatives considered**:
  - **Custom Prometheus install**: Slower to set up and duplicates Encore metrics pipeline.
  - **Third-party APM**: Adds cost without incremental insight for MVP.

## Outstanding Assumptions
- Constitution will be updated later; current plan proceeds with best practices documented above.
- Authentication for Control Panel relies on existing org SSO/OIDC solution; details to be finalized in implementation.
