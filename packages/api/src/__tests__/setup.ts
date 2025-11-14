/**
 * Test setup file - runs before all tests
 * Configures test environment, mocks, and global test utilities
 */

import { afterAll, beforeAll } from "bun:test";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.MEXC_API_KEY =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 64 char hex
process.env.MEXC_SECRET_KEY =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 64 char hex
process.env.MEXC_BASE_URL = "https://api.mexc.com";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5433/test";

// Enable DB tests now that we have test infrastructure
process.env.SKIP_DB_TESTS = process.env.SKIP_DB_TESTS || "false";

// Mock database for tests that don't need real DB
(global as any).mockDb = true;

beforeAll(() => {
  // Setup test environment
  console.log("Setting up test environment...");
});

afterAll(() => {
  // Cleanup test environment
  console.log("Cleaning up test environment...");
});
