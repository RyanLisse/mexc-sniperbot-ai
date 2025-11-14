import { initTRPC, TRPCError } from "@trpc/server";
import { Effect } from "effect";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      effectError: error.cause?.message,
    },
  }),
});

export const router = t.router;

export const publicProcedure = t.procedure;

// Procedure that validates credentials are configured (for operations requiring API access)
export const credentialValidatedProcedure = t.procedure.use(async ({ next }) => {
  const { credentialValidator } = await import("./services/credential-validator");
  const status = credentialValidator.getStatus();

  if (!status.isValid) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: status.error || "MEXC API credentials are not valid. Please check your configuration.",
    });
  }

  return next();
});

// Effect-TS integration helper
export const effectProcedure = <A, E>(effect: Effect.Effect<A, E, never>) =>
  publicProcedure.mutation(async () => {
    const result = await Effect.runPromise(effect);
    return result;
  });

// Export types from services
export type {
  DashboardAlert,
  DashboardPerformanceWindow,
  DashboardSnapshot,
} from "./services/dashboard-service";
export type {
  CoinForecast,
  UpcomingCoinsResponse,
} from "./services/forecast-service";
export { mexcClient } from "./services/mexc-client";
