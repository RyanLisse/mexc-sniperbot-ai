/**
 * Test utilities for conditional test execution
 */

import { test } from "bun:test";

/**
 * Check if database is available for integration tests
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (process.env.SKIP_DB_TESTS === "true") {
    return false;
  }

  // If mockDb flag is set, skip real DB tests
  if ((global as any).mockDb === true) {
    return false;
  }

  try {
    // Try to connect to database
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://test:test@localhost:5432/test",
      connectionTimeoutMillis: 2000,
    });

    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Conditional test that only runs if database is available
 */
export async function testWithDatabase(
  name: string,
  fn: () => void | Promise<void>
) {
  const dbAvailable = await isDatabaseAvailable();

  if (dbAvailable) {
    test(name, fn);
  } else {
    test.skip(name, fn);
    console.warn(`⚠️  Skipping DB test: ${name} (database not available)`);
  }
}

/**
 * Check if external API calls should be made
 */
export function shouldMakeExternalCalls(): boolean {
  return process.env.ALLOW_EXTERNAL_CALLS === "true";
}
