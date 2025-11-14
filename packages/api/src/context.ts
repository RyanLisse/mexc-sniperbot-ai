import { db } from "@mexc-sniperbot-ai/db";
import type { NextRequest } from "next/server";

export type CreateContextOptions = {
  req: NextRequest;
};

export function createContext(opts: CreateContextOptions) {
  const { req } = opts;

  return {
    req,
    db,
    // Add any other context items here
  };
}

export type Context = ReturnType<typeof createContext>;

// Helper function to create context for API routes
export async function createTRPCContext(req: NextRequest) {
  return createContext({
    req,
  });
}
