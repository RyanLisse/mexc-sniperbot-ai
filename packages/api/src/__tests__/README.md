# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the MEXC Sniperbot-AI trading system, including unit tests, integration tests, performance tests, and browser-based E2E tests.

## Test Structure

```
packages/api/src/__tests__/
├── unit/                    # Unit tests for individual components
│   ├── mexc-client.test.ts
│   ├── risk-manager.test.ts
│   └── order-validator.test.ts
├── integration/            # Integration tests for component interactions
│   ├── mexc-client-integration.test.ts
│   └── trade-executor-integration.test.ts
├── performance/            # Performance benchmarks
│   ├── latency.test.ts
│   └── throughput.test.ts
├── websocket/             # WebSocket client tests
│   └── websocket-client.test.ts
├── browser/               # Browser-based E2E tests
│   └── browser-e2e.test.ts
└── mocks/                 # Mock implementations
    ├── mock-exchange-api.ts
    └── mock-websocket-server.ts
```

## Running Tests

### All Tests
```bash
bun test
```

### Unit Tests Only
```bash
bun test:unit
```

### Integration Tests Only
```bash
bun test:integration
```

### Performance Tests Only
```bash
bun test:performance
```

### With Coverage
```bash
bun test:coverage
```

### Watch Mode
```bash
bun test:watch
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **Performance Tests**: Latency and throughput benchmarks
- **E2E Tests**: Key user flows verified

## Performance Targets

- **Order Execution**: P50 < 100ms, P95 < 150ms, P99 < 200ms
- **Order Validation**: < 10ms average
- **Risk Validation**: < 5ms average
- **Throughput**: 1000+ operations/second

## Mock Infrastructure

### Mock Exchange API
The `MockExchangeAPI` class simulates MEXC exchange behavior:
- Order execution
- Balance management
- Price updates
- Error simulation

### Mock WebSocket Server
The `MockWebSocketServer` class provides WebSocket testing:
- Connection management
- Message sending/receiving
- Reconnection simulation

## Writing New Tests

### Unit Test Template
```typescript
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { yourService } from "../../services/your-service";

describe("Your Service - Unit Tests", () => {
  test("should do something", async () => {
    const result = await Effect.runPromise(
      yourService.doSomething()
    );
    
    expect(result).toBeDefined();
  });
});
```

### Integration Test Template
```typescript
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { serviceA } from "../../services/service-a";
import { serviceB } from "../../services/service-b";

describe("Service Integration", () => {
  test("should integrate services correctly", async () => {
    const result = await Effect.runPromise(
      serviceA.pipe(
        Effect.flatMap((a) => serviceB.use(a))
      )
    );
    
    expect(result).toBeDefined();
  });
});
```

## Continuous Integration

Tests are run automatically in CI/CD pipeline:
- All tests must pass
- Coverage must be 80%+
- Performance benchmarks must meet targets

## Debugging Tests

### Run Single Test File
```bash
bun test packages/api/src/__tests__/unit/risk-manager.test.ts
```

### Run Single Test
```bash
bun test packages/api/src/__tests__/unit/risk-manager.test.ts -t "should approve orders"
```

### Debug Mode
```bash
bun --inspect test packages/api/src/__tests__/unit/risk-manager.test.ts
```

## Test Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Clean up test data after each test
3. **Mocking**: Use mocks for external dependencies
4. **Performance**: Keep tests fast (< 1s per test)
5. **Coverage**: Aim for 80%+ code coverage
6. **Documentation**: Document complex test scenarios

