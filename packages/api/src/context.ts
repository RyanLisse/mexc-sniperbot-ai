import type { NextRequest } from "next/server";
import { db } from "@mexc-sniperbot-ai/db";

export interface Session {
  userId: string;
  permissions: string[];
  expiresAt: Date;
}

export interface CreateContextOptions {
  req: NextRequest;
  session: Session | null;
}

export async function createContext(opts: CreateContextOptions) {
  const { req, session } = opts;
  
  return {
    req,
    session,
    db,
    // Add any other context items here
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Helper function to create context for API routes
export async function createTRPCContext(req: NextRequest) {
  // TODO: Implement session validation here
  // For now, return null session
  return createContext({
    req,
    session: null,
  });
}
