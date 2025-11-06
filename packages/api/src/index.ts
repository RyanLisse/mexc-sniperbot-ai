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

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Effect-TS integration helper
export const effectProcedure = <A, E>(
  effect: Effect.Effect<A, E, never>
) => publicProcedure.mutation(async () => {
  const result = await Effect.runPromise(effect);
  return result;
});
