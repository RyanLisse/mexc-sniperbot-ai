/**
 * Test setup file - runs before all tests
 * Configures test environment, mocks, and global test utilities
 */

import { afterAll, beforeAll } from "bun:test";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.MEXC_API_KEY = "test-api-key";
process.env.MEXC_SECRET_KEY = "test-secret-key";
process.env.MEXC_BASE_URL = "https://api.mexc.com";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

beforeAll(() => {
  // Setup test environment
  console.log("Setting up test environment...");
});

afterAll(() => {
  // Cleanup test environment
  console.log("Cleaning up test environment...");
});
