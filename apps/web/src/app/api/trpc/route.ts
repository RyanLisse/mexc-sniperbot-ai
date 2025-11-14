import { createTRPCContext } from "@mexc-sniperbot-ai/api/context";
import { appRouter } from "@mexc-sniperbot-ai/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

const handler = async (req: NextRequest) => {
  return await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: req as unknown as Request,
    router: appRouter,
    createContext: async () => {
      // @ts-expect-error - Next.js version mismatch in Bun's node_modules
      const context = await createTRPCContext(req);
      return context;
    },
  });
};

export { handler as GET, handler as POST };
