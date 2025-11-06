import { index } from 'drizzle-orm/pg-core';
import { tradingConfiguration } from './configuration';
import { listingEvent } from './listing-events';
import { tradeAttempt } from './trade-attempts';
import { botStatus } from './bot-status';
import { userSession } from './user-sessions';

// Note: Indexes will be added directly to table definitions for simplicity
// This avoids JSON parsing issues with Drizzle Kit
export const addIndexesToTables = () => {
  // Indexes are defined directly in table schema files
  return true;
};
