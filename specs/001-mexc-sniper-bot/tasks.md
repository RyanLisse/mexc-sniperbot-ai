---

description: "Task list for MEXC Sniper Bot AI implementation"
---

# Tasks: MEXC Sniper Bot AI

**Input**: Design documents from `/specs/001-mexc-sniper-bot/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Integration and contract tests included for critical trading paths

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `apps/`, `packages/` at repository root
- **Web app**: `apps/web/` for Next.js application
- **Packages**: `packages/api/`, `packages/db/` for business logic and database
- **Tests**: `tests/` at repository root for cross-package testing

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create monorepo structure per implementation plan
- [X] T002 Initialize TypeScript project with Next.js 16 dependencies
- [X] T003 [P] Configure Ultracite for code formatting and linting
- [X] T004 [P] Setup Qlty CLI for multi-linter integration
- [X] T005 [P] Configure Turborepo for build orchestration
- [X] T006 [P] Setup Husky pre-commit hooks for quality gates
- [X] T007 [P] Configure Bun as runtime and package manager

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Setup PostgreSQL database with Supabase integration
- [X] T009 [P] Configure Drizzle ORM with TypeScript schema generation
- [X] T010 [P] Setup tRPC server infrastructure with Next.js integration
- [X] T011 [P] Implement Effect-TS foundation for error handling and async operations
- [X] T012 [P] Setup environment configuration management for API keys
- [X] T013 [P] Configure TanStack Query for client-side data fetching
- [X] T014 Create base TypeScript types and interfaces
- [X] T015 Setup logging infrastructure with structured output
- [X] T016 Configure database connection pooling and performance optimization

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automated Token Sniping (Priority: P1) 🎯 MVP

**Goal**: Implement core trading functionality that detects new MEXC listings and executes buy orders within sub-second timeframes

**Independent Test**: Configure bot with test credentials, monitor for new listings, and verify automatic order placement within 100ms detection and 500ms execution windows

### Implementation for User Story 1

- [X] T017 [P] [US1] Create TradingConfiguration schema in packages/db/src/schema/configuration.ts
- [X] T018 [P] [US1] Create ListingEvent schema in packages/db/src/schema/listing-events.ts
- [X] T019 [P] [US1] Create TradeAttempt schema in packages/db/src/schema/trade-attempts.ts
- [X] T020 [P] [US1] Create BotStatus schema in packages/db/src/schema/bot-status.ts
- [X] T021 [P] [US1] Create database indexes for performance optimization in packages/db/src/schema/indexes.ts
- [X] T022 [P] [US1] Implement MEXC API client service in packages/api/src/services/mexc-client.ts
- [X] T023 [P] [US1] Implement HMAC SHA256 request signing in packages/api/src/services/mexc-signing.ts
- [X] T024 [US1] Create listing detection service in packages/api/src/services/listing-detector.ts
- [X] T025 [US1] Implement trade execution service in packages/api/src/services/trade-executor.ts
- [X] T026 [US1] Create exponential backoff retry logic using Effect-TS in packages/api/src/services/retry-service.ts
- [X] T027 [US1] Implement trading orchestrator service in packages/api/src/services/trading-orchestrator.ts
- [X] T028 [US1] Create configuration router procedures in packages/api/src/routers/configuration.ts
- [X] T029 [US1] Create trading router procedures in packages/api/src/routers/trading.ts
- [X] T030 [US1] Create monitoring router procedures in packages/api/src/routers/monitoring.ts
- [X] T031 [US1] Implement background listing monitor in packages/api/src/services/listing-monitor.ts
- [X] T032 [US1] Create trade attempt logging service in packages/api/src/services/trade-logger.ts
- [X] T033 [US1] Implement performance monitoring service in packages/api/src/services/performance-monitor.ts
- [X] T034 [US1] Create basic dashboard page in apps/web/src/app/dashboard/page.tsx
- [X] T035 [US1] Implement real-time trade status display in apps/web/src/components/trade-status.tsx
- [X] T036 [US1] Create listing events display component in apps/web/src/components/listing-events.tsx
- [X] T037 [US1] Implement bot status indicator in apps/web/src/components/bot-status.tsx
- [X] T038 [US1] Create TanStack Query hooks for trading data in apps/web/src/hooks/use-trading.ts
- [X] T039 [US1] Implement real-time data subscriptions in apps/web/src/hooks/use-realtime.ts

### Tests for User Story 1 ✅

- [X] T040 [P] [US1] Contract test for MEXC API integration in tests/contract/test-mexc-api.ts
- [X] T041 [P] [US1] Integration test for listing detection flow in tests/integration/test-listing-detection.ts
- [X] T042 [P] [US1] Integration test for trade execution flow in tests/integration/test-trade-execution.ts
- [X] T043 [P] [US1] Performance test for sub-second requirements in tests/performance/test-timing.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Real-Time Dashboard (Priority: P2)

**Goal**: Provide comprehensive real-time dashboard displaying active listings, bot status, and trade logs with 1-second update latency

**Independent Test**: Access web interface and verify dashboard data updates in real-time as simulated trading events occur

### Implementation for User Story 2

- [ ] T044 [P] [US2] Create UserSession schema in packages/db/src/schema/user-sessions.ts
- [ ] T045 [P] [US2] Implement authentication service in packages/api/src/services/auth-service.ts
- [ ] T046 [P] [US2] Create authentication router procedures in packages/api/src/routers/auth.ts
- [ ] T047 [US2] Implement session management middleware in packages/api/src/middleware/auth.ts
- [ ] T048 [P] [US2] Create enhanced dashboard layout in apps/web/src/app/dashboard/layout.tsx
- [ ] T049 [P] [US2] Implement trade history table component in apps/web/src/components/trade-history.tsx
- [ ] T050 [P] [US2] Create performance metrics widget in apps/web/src/components/performance-metrics.tsx
- [ ] T051 [P] [US2] Implement alert system component in apps/web/src/components/alerts.tsx
- [ ] T052 [US2] Create real-time subscription hooks in apps/web/src/hooks/use-subscriptions.ts
- [ ] T053 [US2] Implement dashboard data aggregation service in packages/api/src/services/dashboard-service.ts
- [ ] T054 [US2] Create WebSocket integration for real-time updates in packages/api/src/services/websocket-service.ts
- [ ] T055 [US2] Implement error boundary for dashboard in apps/web/src/components/error-boundary.tsx
- [ ] T056 [US2] Create responsive dashboard design in apps/web/src/styles/dashboard.css

### Tests for User Story 2 ⚠️

- [ ] T057 [P] [US2] Integration test for real-time dashboard updates in tests/integration/test-dashboard-realtime.ts
- [ ] T058 [P] [US2] Contract test for authentication flows in tests/contract/test-auth.ts
- [ ] T059 [P] [US2] Performance test for dashboard rendering in tests/performance/test-dashboard.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Configuration Management (Priority: P2)

**Goal**: Enable users to configure trading parameters (coin pairs, amounts, price tolerance) with immediate effect on trading behavior

**Independent Test**: Modify configuration settings through UI and verify bot behavior changes accordingly in subsequent trading operations

### Implementation for User Story 3

- [ ] T060 [P] [US3] Create settings page layout in apps/web/src/app/settings/page.tsx
- [ ] T061 [P] [US3] Implement trading parameters form in apps/web/src/components/trading-form.tsx
- [ ] T062 [P] [US3] Create risk management settings component in apps/web/src/components/risk-settings.tsx
- [ ] T063 [P] [US3] Implement configuration validation service in packages/api/src/services/config-validator.ts
- [ ] T064 [P] [US3] Create configuration persistence service in packages/api/src/services/config-service.ts
- [ ] T065 [P] [US3] Implement real-time configuration updates in packages/api/src/services/config-updater.ts
- [ ] T066 [US3] Create configuration form hooks in apps/web/src/hooks/use-configuration.ts
- [ ] T067 [US3] Implement configuration preview component in apps/web/src/components/config-preview.tsx
- [ ] T068 [US3] Create configuration reset functionality in apps/web/src/components/config-reset.tsx

### Tests for User Story 3 ⚠️

- [ ] T069 [P] [US3] Integration test for configuration persistence in tests/integration/test-configuration.ts
- [ ] T070 [P] [US3] Contract test for configuration validation in tests/contract/test-config-validation.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Security & API Management (Priority: P3)

**Goal**: Secure MEXC API credentials with proper access controls and implement HMAC SHA256 request signing

**Independent Test**: Verify API keys are stored in environment variables, never exposed in client-side code, and IP restrictions are properly configured

### Implementation for User Story 4

- [ ] T071 [P] [US4] Implement secure environment variable handling in packages/api/src/lib/env.ts
- [ ] T072 [P] [US4] Create API key validation service in packages/api/src/services/api-key-validator.ts
- [ ] T073 [P] [US4] Implement IP whitelisting service in packages/api/src/services/ip-whitelist.ts
- [ ] T074 [P] [US4] Create secure credential storage interface in packages/api/src/lib/credentials.ts
- [ ] T075 [P] [US4] Implement security audit logging in packages/api/src/services/security-logger.ts
- [ ] T076 [P] [US4] Create security monitoring dashboard in apps/web/src/app/security/page.tsx
- [ ] T077 [P] [US4] Implement credential rotation service in packages/api/src/services/credential-rotation.ts
- [ ] T078 [US4] Create security configuration component in apps/web/src/components/security-config.tsx

### Tests for User Story 4 ⚠️

- [ ] T079 [P] [US4] Security test for credential exposure in tests/security/test-credential-exposure.ts
- [ ] T080 [P] [US4] Integration test for HMAC signing in tests/integration/test-hmac-signing.ts
- [ ] T081 [P] [US4] Contract test for API security in tests/contract/test-api-security.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T082 [P] Documentation updates in docs/
- [ ] T083 [P] Code cleanup and refactoring across all packages
- [ ] T084 [P] Performance optimization across all stories
- [ ] T085 [P] Additional unit tests in tests/unit/
- [ ] T086 [P] Security hardening and audit
- [ ] T087 [P] Error handling improvements and user feedback
- [ ] T088 [P] Monitoring and alerting enhancements
- [ ] T089 [P] Database optimization and query performance
- [ ] T090 [P] Frontend optimization and bundle size reduction
- [ ] T091 [P] Deployment configuration and CI/CD setup
- [ ] T092 Run quickstart.md validation and documentation completeness
- [ ] T093 Final integration testing across all user stories
- [ ] T094 Performance validation against success criteria
- [ ] T095 Security audit and compliance verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2/US3 → US4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Security foundation for all stories

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Database schemas before services
- Services before routers/API endpoints
- Core implementation before frontend integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Database schemas within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for MEXC API integration in tests/contract/test-mexc-api.ts"
Task: "Integration test for listing detection flow in tests/integration/test-listing-detection.ts"
Task: "Integration test for trade execution flow in tests/integration/test-trade-execution.ts"
Task: "Performance test for sub-second requirements in tests/performance/test-timing.ts"

# Launch all database schemas for User Story 1 together:
Task: "Create TradingConfiguration schema in packages/db/src/schema/configuration.ts"
Task: "Create ListingEvent schema in packages/db/src/schema/listing-events.ts"
Task: "Create TradeAttempt schema in packages/db/src/schema/trade-attempts.ts"
Task: "Create BotStatus schema in packages/db/src/schema/bot-status.ts"
Task: "Create database indexes for performance optimization in packages/db/src/schema/indexes.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Core trading)
   - Developer B: User Story 2 (Dashboard)
   - Developer C: User Story 3 (Configuration)
   - Developer D: User Story 4 (Security)
3. Stories complete and integrate independently
4. Final integration and polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Success Criteria Validation

Each user story includes validation against the original success criteria:

- **US1**: Validates <100ms detection and <500ms execution requirements
- **US2**: Validates <1 second dashboard update requirements
- **US3**: Validates configuration persistence and application requirements
- **US4**: Validates security and credential protection requirements

All tasks are designed to meet the constitution's performance, type safety, and reliability requirements.
