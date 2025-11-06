import { publicProcedure, router } from "../index";
import { todoRouter } from "./todo";

// Placeholder routers - will be implemented in user stories
const configurationRouter = router({
  getConfiguration: publicProcedure.query(() => ({
    message: "Configuration router - to be implemented",
  })),
});

const tradingRouter = router({
  getTradeHistory: publicProcedure.query(() => ({
    message: "Trading router - to be implemented",
  })),
});

const monitoringRouter = router({
  getBotStatus: publicProcedure.query(() => ({
    message: "Monitoring router - to be implemented",
  })),
});

const authRouter = router({
  getCurrentUser: publicProcedure.query(() => ({
    message: "Auth router - to be implemented",
  })),
});

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  configuration: configurationRouter,
  trading: tradingRouter,
  monitoring: monitoringRouter,
  auth: authRouter,
  todo: todoRouter, // Keep for development/testing
});

export type AppRouter = typeof appRouter;
