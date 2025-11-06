import { publicProcedure, router } from "../index";
import { todoRouter } from "./todo";
import { configurationRouter } from "./configuration";
import { tradingRouter } from "./trading";
import { monitoringRouter } from "./monitoring";

const authRouter = router({
  getCurrentUser: publicProcedure.query(() => ({
    message: "Auth router - to be implemented",
  })),
});

// Main app router combining all routers
export const appRouter = router({
  healthCheck: publicProcedure.query(() => ({
    message: "MEXC Sniper Bot API is healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    endpoints: {
      todos: "Todo management",
      configuration: "Trading configuration management",
      trading: "Trading operations and bot control",
      monitoring: "System monitoring and health checks",
    },
  })),
  auth: authRouter,
  todos: todoRouter,
  configuration: configurationRouter,
  trading: tradingRouter,
  monitoring: monitoringRouter,
});

export type AppRouter = typeof appRouter;

// Export router and procedures for other modules
export { router, publicProcedure } from "../index";
