import { createTRPCContext } from "@mexc-sniperbot-ai/api/context";
import { appRouter } from "@mexc-sniperbot-ai/api/routers/index";
import { credentialValidator } from "@mexc-sniperbot-ai/api/services/credential-validator";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

// Initialize credential validation on module load
let credentialsInitialized = false;
if (!credentialsInitialized) {
  credentialsInitialized = true;
  credentialValidator.startPeriodicValidation();
}

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
