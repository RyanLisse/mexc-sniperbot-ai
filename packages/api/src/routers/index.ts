import { publicProcedure, router } from "../index";
import { calendarRouter } from "./calendar";
import { configurationRouter } from "./configuration";
import { dashboardRouter } from "./dashboard";
import { forecastRouter } from "./forecast";
import { monitoringRouter } from "./monitoring";
import { portfolioRouter } from "./portfolio";
import { tradingRouter } from "./trading";

// Main app router combining all routers
export const appRouter = router({
  healthCheck: publicProcedure.query(async () => {
    const { credentialValidator } = await import("../services/credential-validator");
    const credentialStatus = credentialValidator.getStatus();

    return {
      message: "MEXC Sniper Bot API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      credentials: {
        isValid: credentialStatus.isValid,
        lastValidated: credentialStatus.lastValidated?.toISOString() || null,
        error: credentialStatus.error || null,
      },
      endpoints: {
        configuration: "Trading configuration management",
        trading: "Trading operations and bot control",
        monitoring: "System monitoring and health checks",
        dashboard: "Dashboard data and real-time updates",
        portfolio: "Portfolio and account balance management",
        calendar: "MEXC calendar listings",
        forecast: "Coin forecast data",
      },
    };
  }),
  configuration: configurationRouter,
  trading: tradingRouter,
  monitoring: monitoringRouter,
  dashboard: dashboardRouter,
  portfolio: portfolioRouter,
  calendar: calendarRouter,
  forecast: forecastRouter,
});

export type AppRouter = typeof appRouter;

// Export router and procedures for other modules
export { publicProcedure, router } from "../index";
