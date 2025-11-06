import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const userSession = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Authentication
  userId: uuid('user_id').notNull(),
  sessionToken: text('session_token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // Access Control
  permissions: text('permissions').array().notNull().default([]),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  
  // Activity Tracking
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  loginAt: timestamp('login_at').notNull().defaultNow(),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;
