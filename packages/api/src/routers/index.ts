import { publicProcedure, router } from "../index";
import { todoRouter } from "./todo";

// Placeholder routers - will be implemented in user stories
const configurationRouter = router({
  getConfiguration: publicProcedure.query(() => {
    return { message: "Configuration router - to be implemented" };
  }),
});

const tradingRouter = router({
  getTradeHistory: publicProcedure.query(() => {
    return { message: "Trading router - to be implemented" };
  }),
});

const monitoringRouter = router({
  getBotStatus: publicProcedure.query(() => {
    return { message: "Monitoring router - to be implemented" };
  }),
});

const authRouter = router({
  getCurrentUser: publicProcedure.query(() => {
    return { message: "Auth router - to be implemented" };
  }),
});

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  configuration: configurationRouter,
  trading: tradingRouter,
  monitoring: monitoringRouter,
  auth: authRouter,
  todo: todoRouter, // Keep for development/testing
});

export type AppRouter = typeof appRouter;
