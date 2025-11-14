# Implementation Plan: Encore Trading Refactor

**Branch**: `[001-encore-refactor]` | **Date**: 2025-11-13 | **Spec**: `/specs/001-encore-refactor/spec.md`
**Input**: Feature specification from `/specs/001-encore-refactor/spec.md`

## Summary

Refactor the bot backend to Encore.dev with co-located PostgreSQL and a Next.js 16 Control Panel. Encore services handle listing detection, order execution via mexc-api-sdk, safety constraints, and telemetry; the Control Panel issues commands and polls Encore APIs. Key outcomes: sub-second signal → order latency, managed secrets, auditable trade ledger, operator dashboards.

## Technical Context

**Language/Version**: TypeScript (Encore runtime + React 19 / Next.js 16)
**Primary Dependencies**: `encore.dev/api`, mexc-api-sdk (Spot), React Query, shadcn/ui, TanStack Form, Drizzle ORM, Pino logging, Encore Cron & Pub/Sub where needed
**Storage**: Encore-managed PostgreSQL (`BotDB`) for runtime data; reuse `packages/db` schema definitions for compatibility exports
**Testing**: Encore test runner for workflows, Vitest/Jest inside packages, Playwright for Control Panel flows, OpenAPI contract tests
**Target Platform**: Encore-managed Linux compute (ap-northeast-1 / ap-southeast-1) plus Vercel-hosted Next.js frontend
**Project Type**: Multi-app monorepo (Encore backend in `packages/api`, Next.js frontend in `apps/web`, shared DB package)
**Performance Goals**: <2s start/stop acknowledgement, <1s median signal→order submission, ≥99% dashboard poll success with ≤5s staleness, <100 ms Encore DB write latency
**Constraints**: recvWindow ≤ 1000 ms, MEXC 5 orders/sec rate limit, safety caps for spend + trades/hour, Secrets never printed/logged, Encore region must remain low-latency to MEXC
**Scale/Scope**: Up to 100 listings/hour, multi-operator UI, audit logs ≥30 days, single region initial deployment with future multi-region expansion optional

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `.specify/memory/constitution.md` contains only placeholders, no enforceable principles. Record assumption that governance will finalize constitution later. No blockers identified. **Gate status: PASS (no rules to violate, flag for governance follow-up).**

## Project Structure

### Documentation (this feature)

```text
specs/001-encore-refactor/
├── plan.md          # Implementation plan
├── research.md      # Phase 0 research output
├── data-model.md    # Phase 1 entity definitions
├── quickstart.md    # Phase 1 integration scenarios
├── contracts/       # Phase 1 API specs
└── tasks.md         # Generated later via /speckit.tasks
```

### Source Code (repository root)

```text
apps/
└── web/                     # Next.js 16 Control Panel (React 19 + shadcn)

packages/
├── api/                     # Encore backend (services, workflows, cron jobs)
├── db/                      # Drizzle schema, migrations, shared SQL helpers
└── shared/*                 # (future) cross-cutting utilities or SDKs

ai_docs/encore_plan.md       # Architectural reference for Encore setup
.specify/                    # Automation workflows & scripts
```

**Structure Decision**: Keep existing monorepo layout—Encore backend code in `packages/api`, React UI in `apps/web`, shared DB definitions in `packages/db`, docs in `specs/001-encore-refactor`. No additional top-level folders required.

## Complexity Tracking

_No constitution violations identified; table intentionally left empty._
