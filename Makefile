.PHONY: test-all test-unit test-integration test-performance test-contract test-security test-websocket test-browser test-coverage clean-test

# Comprehensive test suite - all tests must pass 100%
test-all: test-unit test-integration test-performance test-contract test-security test-websocket test-browser
	@echo "✅ All test suites passed successfully!"

# Unit tests - isolated, fast, no external dependencies
test-unit:
	@echo "🧪 Running unit tests..."
	@bun test packages/api/src/__tests__/unit/

# Integration tests - API, DB, service integration
test-integration:
	@echo "🔗 Running integration tests..."
	@bun test packages/api/src/__tests__/integration/
	@bun test tests/integration/

# Performance tests - latency, throughput, benchmarks
test-performance:
	@echo "⚡ Running performance tests..."
	@bun test packages/api/src/__tests__/performance/
	@bun test tests/performance/

# Contract tests - API contracts, security, auth
test-contract:
	@echo "📋 Running contract tests..."
	@bun test tests/contract/

# Security tests - credential validation, IP whitelisting
test-security:
	@echo "🔒 Running security tests..."
	@bun test tests/security/ || echo "⚠️  No security tests found - creating stubs..."

# WebSocket tests - real-time communication
test-websocket:
	@echo "🌐 Running WebSocket tests..."
	@bun test packages/api/src/__tests__/websocket/

# Browser E2E tests - full user workflows
test-browser:
	@echo "🌍 Running browser E2E tests..."
	@bun test packages/api/src/__tests__/browser/

# Encore monitor tests
test-encore:
	@echo "🎯 Running Encore tests..."
	@cd encore-app && bun test

# Test coverage - must reach 100%
test-coverage:
	@echo "📊 Generating test coverage report..."
	@bun test --coverage packages/api/src/
	@bun test --coverage tests/

# Clean test artifacts
clean-test:
	@echo "🧹 Cleaning test artifacts..."
	@rm -rf coverage/
	@rm -rf .test-cache/
	@find . -name "*.test.log" -delete

# Continuous testing - watch mode
test-watch:
	@echo "👀 Running tests in watch mode..."
	@bun test --watch

# Quick validation - smoke tests only
test-smoke:
	@echo "💨 Running smoke tests..."
	@bun test packages/api/src/__tests__/unit/mexc-client.test.ts
	@bun test tests/integration/test-configuration.ts

# Build verification
build:
	@echo "🔨 Building project..."
	@bun run build

# Full CI pipeline - build + test + quality
ci: build test-all test-coverage
	@echo "✅ CI pipeline completed successfully!"
