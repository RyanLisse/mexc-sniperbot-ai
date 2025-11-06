<!--
SYNC IMPACT REPORT
==================
Version Change: TEMPLATE → 1.0.0
Modified Principles: Initial creation - all principles are new
Added Sections: All sections (initial creation)
Removed Sections: None
Templates Status:
  ✅ plan-template.md - Constitution Check section present and compatible
  ✅ spec-template.md - Requirements structure aligns with constitution principles
  ✅ tasks-template.md - Task organization supports principle-driven development
Follow-up TODOs: None - all placeholders filled
-->

# MEXC Sniper Bot AI Constitution

## Core Principles

### I. Type Safety First (NON-NEGOTIABLE)

End-to-end type safety MUST be enforced across the entire stack:
- TypeScript MUST be used with strict mode enabled for all code
- All API boundaries MUST use tRPC for type-safe client-server communication
- Database schemas MUST use Drizzle ORM with full TypeScript inference
- Effect-TS MUST be used for all asynchronous operations to ensure type-safe error handling
- `any` type is FORBIDDEN except in explicit third-party integration boundaries with justification
- All function parameters and return types MUST be explicitly typed when they enhance clarity

**Rationale**: Trading systems cannot tolerate runtime type errors. A single type mismatch could result in incorrect trade execution, lost funds, or system downtime. TypeScript's compile-time guarantees prevent entire classes of bugs before deployment.

### II. Effect-Driven Architecture

All business logic and I/O operations MUST use Effect-TS patterns:
- API calls, database queries, and external service integrations MUST be wrapped in Effect types
- Error handling MUST use Effect's type-safe error channels (no throw/catch for business logic)
- Retry logic and timeouts MUST use Effect's built-in operators
- Async operations MUST compose through Effect pipelines, not raw Promises
- All side effects MUST be explicit and trackable through the Effect type system

**Rationale**: Financial trading systems require predictable error handling and robust retry mechanisms. Effect-TS provides composable, testable, and type-safe handling of failures, which is critical when dealing with API rate limits, network issues, and exchange downtime.

### III. Performance Critical (SUB-SECOND IMPERATIVE)

Performance is a functional requirement, not an optimization:
- New listing detection MUST complete within 100ms of exchange API response
- Trade execution logic MUST complete within 500ms from detection to order submission
- Database queries MUST use indexed fields and complete in <50ms
- All hot paths MUST be profiled; any operation >100ms MUST be justified
- Memory usage MUST remain under 512MB during normal operation
- Frontend interactions MUST respond within 100ms; data fetching within 1 second

**Rationale**: In cryptocurrency sniping, milliseconds determine success or failure. Late trades can miss favorable prices or fail entirely. Performance is not negotiable—it directly impacts profitability and competitive advantage.

### IV. Monorepo Hygiene

Code organization MUST follow strict monorepo principles:
- Packages MUST contain pure business logic with zero framework dependencies (`packages/api`, `packages/db`)
- Apps MUST consume packages through clean imports (`apps/web`)
- Shared code MUST live in packages, not duplicated across apps
- Circular dependencies between packages are FORBIDDEN
- Each package MUST have a clear, single responsibility
- Turborepo MUST be used for build orchestration and caching

**Rationale**: Clear separation enables independent testing, parallel development, and prevents framework lock-in. Business logic in packages can be reused across multiple consumers (web UI, CLI, background workers) without duplication.

### V. Code Quality Automation (ZERO-CONFIG)

Code quality MUST be enforced automatically with zero manual intervention:
- Ultracite (Biome preset) MUST handle all formatting and linting
- All code MUST pass `bun run check-types` with zero errors
- Husky pre-commit hooks MUST enforce quality gates before commits
- CI MUST run `biome check` and type checks; failures MUST block merges
- Manual code formatting is FORBIDDEN—let tooling handle it
- Qlty CLI MUST be integrated for multi-linter security and style checks in CI

**Rationale**: Manual code review for style issues wastes time. Automated enforcement ensures consistency, catches common bugs, and allows developers to focus on business logic rather than formatting debates.

### VI. Reliability & Defensive Design

The system MUST handle failures gracefully:
- All external API calls MUST implement exponential backoff retry (Effect.retry)
- Network failures MUST NOT crash the application—errors MUST be logged and recovered
- Database operations MUST use transactions where data consistency matters
- All trade attempts MUST be logged with full context (timestamp, parameters, result)
- Critical errors MUST surface to monitoring/alerting (structured logging)
- Fallback mechanisms MUST exist for non-critical failures (e.g., graceful degradation)

**Rationale**: Exchanges experience downtime, rate limits, and network issues. A robust sniper bot must survive these conditions without manual intervention. Silent failures in trading are unacceptable—all errors must be observable and actionable.

## Security & Operational Standards

### API Key Management

- MEXC API keys MUST be stored in environment variables, never committed to code
- API secrets MUST use OS-level secret management (dotenv for local, secret manager for production)
- IP whitelisting MUST be enabled on MEXC API keys where supported
- API keys MUST have minimum required permissions (spot trading only, no withdrawal access)
- Secrets MUST NOT appear in logs, error messages, or client-side bundles

### Data Persistence

- All trade execution attempts (successful or failed) MUST be persisted to the database
- Database schema changes MUST use Drizzle migrations (`bun run db:push`)
- PostgreSQL indexes MUST be created for all frequently queried fields
- Database connection pooling MUST be configured appropriately for expected load
- Sensitive data (API keys) MUST NOT be stored in the database in plain text

## Development Workflow

### Pre-Implementation Checklist

Before starting any feature implementation:
1. Verify feature spec exists in `/specs/[###-feature-name]/spec.md`
2. Confirm implementation plan exists in `/specs/[###-feature-name]/plan.md`
3. Review Constitution Check section in plan.md for compliance gates
4. Ensure all type definitions are clear before writing implementation code

### Quality Gates

- All code MUST pass TypeScript type checking with zero errors
- All code MUST pass Biome/Ultracite checks with zero warnings
- Tests (if required by spec) MUST be written BEFORE implementation
- PR merges MUST be blocked by failing CI checks
- Complex logic MUST include inline comments explaining the "why", not the "what"

### Testing Discipline (WHEN SPECIFIED)

- Integration tests MUST cover critical paths: API integration, trade execution, error scenarios
- Contract tests MUST verify API schema expectations match MEXC documentation
- Unit tests SHOULD focus on business logic in packages, not framework glue code
- All tests MUST use Bun's test runner (`bun test`)
- Tests MUST be deterministic—no flaky tests allowed

## Governance

This constitution supersedes all other development practices and guidelines. All implementation decisions MUST align with these principles.

### Amendment Process

1. Proposed changes MUST be documented with rationale and impact analysis
2. Constitution changes MUST follow semantic versioning:
   - **MAJOR**: Principle removal or redefinition (breaking)
   - **MINOR**: New principles or expanded guidance
   - **PATCH**: Clarifications, typo fixes, non-semantic improvements
3. All amendments MUST propagate to dependent templates (spec, plan, tasks)
4. Amendment approval requires validation that existing code can comply or migration plan exists

### Compliance Review

- All PRs MUST self-certify constitution compliance in description
- Plan.md MUST include a Constitution Check section identifying any violations
- Complexity violations MUST be justified with "Why Needed" and "Simpler Alternative Rejected" reasoning
- Unjustified violations MUST block implementation until resolved

### Runtime Guidance

For AI assistants and developers working on this project:
- Follow AGENT.md for real-time coding standards and Ultracite/Biome rules
- Use constitution principles to guide architectural decisions
- When in doubt, prioritize type safety, performance, and reliability
- Document deviations with explicit justification

**Version**: 1.0.0 | **Ratified**: 2025-01-06 | **Last Amended**: 2025-01-06
