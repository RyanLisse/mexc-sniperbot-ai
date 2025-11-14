# Phase 3B: Integration & Performance Test Infrastructure

**Goal:** Achieve 90%+ test coverage with all integration and performance tests passing

**Current Status:** 82/109 validated tests passing (75%)  
**Target:** 200+ tests passing (90%+)

## Task Breakdown

### Task 1: Database Test Infrastructure
**Priority:** High  
**Estimated Effort:** 2-3 hours  
**Impact:** +21 integration tests

#### Subtasks:
1. Create `docker-compose.test.yml` for test PostgreSQL
   ```yaml
   services:
     test-db:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: test
         POSTGRES_PASSWORD: test
         POSTGRES_DB: test
       ports:
         - "5433:5432"
   ```

2. Create test DB initialization script (`scripts/init-test-db.sh`)
   - Start test database
   - Run migrations
   - Seed test data

3. Update integration tests to use test database
   - Modify `test-buy-sell-cycle.ts`
   - Modify `test-configuration.ts`
   - Modify `test-position-monitoring.ts`
   - Modify `test-sell-strategies.ts`

4. Add DB teardown/cleanup between tests
   - Create `beforeEach` hooks for DB reset
   - Add transaction rollback support

**Acceptance Criteria:**
- [ ] Test database starts with `make test-db-start`
- [ ] All 21 integration tests pass with test DB
- [ ] Tests are isolated (no data leakage)
- [ ] DB teardown is automatic

---

### Task 2: MEXC API Mocking
**Priority:** High  
**Estimated Effort:** 3-4 hours  
**Impact:** +40 integration/performance tests

#### Subtasks:
1. Create comprehensive mock MEXC API service
   - `packages/api/src/__tests__/mocks/mock-mexc-service.ts`
   - Mock endpoints: `/api/v3/order`, `/api/v3/account`, `/api/v3/ticker/price`
   - Support all order types (market, limit)

2. Create mock WebSocket server
   - `packages/api/src/__tests__/mocks/mock-websocket-server.ts`
   - Simulate market data streams
   - Handle subscriptions/unsubscriptions

3. Create mock calendar API
   - `packages/api/src/__tests__/mocks/mock-calendar-api.ts`
   - Return deterministic listing data
   - Support filtering and date ranges

4. Update tests to use mocks conditionally
   ```typescript
   const useMocks = process.env.USE_MOCK_API === "true" || !isDatabaseAvailable();
   const mexcClient = useMocks ? new MockMEXCClient() : new MEXCClient();
   ```

**Acceptance Criteria:**
- [ ] All MEXC API endpoints mocked
- [ ] WebSocket server simulates real behavior
- [ ] Calendar API returns deterministic data
- [ ] Tests pass with `USE_MOCK_API=true`

---

### Task 3: Performance Test Optimization
**Priority:** Medium  
**Estimated Effort:** 2 hours  
**Impact:** +5 performance tests

#### Subtasks:
1. Create mock performance infrastructure
   - Deterministic latency simulation
   - Configurable response times
   - No real API calls

2. Update performance tests to use mocks
   - `test-timing.test.ts`: Use mock order executor
   - Adjust thresholds for mocked environment

3. Add performance benchmarking utilities
   - Mock latency tracker
   - Simulated throughput testing

**Acceptance Criteria:**
- [ ] P50/P95/P99 tests pass with mocks
- [ ] Order validation latency test passes
- [ ] Concurrent operations test passes
- [ ] Performance thresholds are realistic for mocked env

---

### Task 4: Security Test Implementation
**Priority:** Medium  
**Estimated Effort:** 2 hours  
**Impact:** +10 security tests

#### Subtasks:
1. Implement credential exposure tests
   - Test API keys not logged
   - Test secrets not in responses
   - Test error messages sanitized

2. Implement IP whitelist tests
   - Test IP validation logic
   - Test blocked IPs rejected
   - Test allowed IPs accepted

3. Implement API key rotation tests
   - Test key update scenarios
   - Test old keys invalidated
   - Test new keys activated

**Acceptance Criteria:**
- [ ] Credential exposure tests implemented
- [ ] IP whitelist tests implemented
- [ ] API key rotation tests implemented
- [ ] All security tests passing

---

### Task 5: Browser E2E Tests
**Priority:** Low  
**Estimated Effort:** 4-6 hours  
**Impact:** +20-30 E2E tests

#### Subtasks:
1. Set up Playwright
   ```bash
   bun add -D @playwright/test
   npx playwright install
   ```

2. Create E2E test structure
   - `tests/e2e/dashboard.spec.ts`
   - `tests/e2e/trading.spec.ts`
   - `tests/e2e/configuration.spec.ts`

3. Implement dashboard tests
   - Test listing display
   - Test real-time updates
   - Test WebSocket reconnection

4. Implement trading workflow tests
   - Test order placement
   - Test position monitoring
   - Test sell execution

**Acceptance Criteria:**
- [ ] Playwright configured
- [ ] Dashboard tests implemented
- [ ] Trading workflow tests implemented
- [ ] Tests pass in headless mode

---

## Implementation Order

### Week 1: Core Infrastructure
1. **Day 1-2:** Task 1 (Database Test Infrastructure)
   - Set up docker-compose
   - Configure test database
   - Update integration tests

2. **Day 3-5:** Task 2 (MEXC API Mocking)
   - Create mock services
   - Update tests to use mocks
   - Verify all integration tests pass

### Week 2: Optimization & Security
3. **Day 1-2:** Task 3 (Performance Test Optimization)
   - Implement mock performance infrastructure
   - Update performance tests

4. **Day 3-4:** Task 4 (Security Test Implementation)
   - Implement security test suite

5. **Day 5:** Testing & Documentation
   - Run full test suite
   - Update documentation
   - Create PR for review

### Week 3 (Optional): E2E Tests
6. **Day 1-5:** Task 5 (Browser E2E Tests)
   - Set up Playwright
   - Implement E2E scenarios

---

## Success Metrics

### Phase 3B Complete When:
- [ ] 90%+ test coverage achieved
- [ ] All integration tests passing (21/21)
- [ ] All performance tests passing (5/5)
- [ ] Security tests implemented and passing (10/10)
- [ ] No skipped tests in CI pipeline
- [ ] Test execution time < 5 minutes for full suite

### Quality Gates:
- [ ] `make test-all` passes 100%
- [ ] `make test-coverage` shows 90%+ coverage
- [ ] `make ci` completes successfully
- [ ] No timeout failures
- [ ] No database connection errors

---

## Environment Setup

### Required Environment Variables:
```bash
# Test Database
DATABASE_URL=postgresql://test:test@localhost:5433/test

# MEXC API (use mocks by default)
USE_MOCK_API=true
MEXC_API_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
MEXC_SECRET_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# Test Configuration
NODE_ENV=test
SKIP_DB_TESTS=false  # Enable after DB setup
ALLOW_EXTERNAL_CALLS=false
```

### Docker Services:
```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Stop test database
docker-compose -f docker-compose.test.yml down

# Reset test database
docker-compose -f docker-compose.test.yml down -v && \
docker-compose -f docker-compose.test.yml up -d
```

---

## Dependencies

### Required Packages:
- `@playwright/test` - Browser automation (Task 5)
- `testcontainers` - Docker test containers (optional)
- `nock` - HTTP mocking (Task 2)
- `ws` - WebSocket testing (Task 2)

### Install:
```bash
bun add -D @playwright/test testcontainers nock ws @types/ws
```

---

## Rollout Strategy

### Phase 3B-Alpha (Week 1)
- Database infrastructure
- API mocking
- Integration tests passing

### Phase 3B-Beta (Week 2)
- Performance optimization
- Security tests
- 90% coverage achieved

### Phase 3B-GA (Week 3)
- E2E tests (optional)
- Full documentation
- Production-ready

---

## Rollback Plan

If Phase 3B causes issues:
1. Revert to Phase 3A checkpoint (commit e066096)
2. Keep test infrastructure (Makefile, bunfig.toml)
3. Continue using mock-only approach for unit tests
4. Document integration/performance tests as "manual testing required"

---

## Resources

### Documentation:
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Effect-TS Testing](https://effect.website/docs/guides/testing)
- [Playwright](https://playwright.dev)
- [PostgreSQL Test Containers](https://node.testcontainers.org/modules/postgresql/)

### Example Implementations:
- `packages/api/src/__tests__/mocks/mock-exchange-api.ts` - Current mock example
- `packages/api/src/__tests__/websocket/websocket-client.test.ts` - WebSocket testing
- `tests/contract/test-mexc-api.test.ts` - Contract testing pattern

---

## Monitoring Progress

Track progress using:
```bash
# Test count
make test-all | grep "Ran"

# Coverage percentage
make test-coverage | grep "All files"

# Failure analysis
make test-all 2>&1 | grep -E "(fail|error)" | wc -l
```

---

## Sign-off Criteria

Phase 3B is complete when:
- [ ] All tasks marked complete
- [ ] All acceptance criteria met
- [ ] Documentation updated
- [ ] PR approved by tech lead
- [ ] CI/CD pipeline green
