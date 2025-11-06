import { db } from "@mexc-sniperbot-ai/db";
import type { NextRequest } from "next/server";

export type Session = {
  userId: string;
  permissions: string[];
  expiresAt: Date;
};

export type CreateContextOptions = {
  req: NextRequest;
  session: Session | null;
};

export function createContext(opts: CreateContextOptions) {
  const { req, session } = opts;

  return {
    req,
    session,
    db,
    // Add any other context items here
  };
}

export type Context = ReturnType<typeof createContext>;

// Helper function to create context for API routes
export function createTRPCContext(req: NextRequest) {
  // TODO: Implement session validation here
  // For now, return null session
  return createContext({
    req,
    session: null,
  });
}
