import { Context, Effect, Layer } from "effect";
import { TradingError, TradingLogger } from "../lib/effect";
import { listingDetector } from "./listing-detector";

// Service interface for dependency injection
export type ListingMonitorService = {
  startMonitoring: () => Effect.Effect<void, TradingError>;
  stopMonitoring: () => Effect.Effect<void, TradingError>;
  isMonitoring: () => Effect.Effect<boolean, TradingError>;
  getMonitoringStats: () => Effect.Effect<MonitoringStats, TradingError>;
};

// Service tag
export const ListingMonitorServiceTag = Context.Tag<ListingMonitorService>(
  "ListingMonitorService"
);

// Monitoring statistics type
export type MonitoringStats = {
  isRunning: boolean;
  startTime?: Date;
  totalCycles: number;
  lastCycleTime?: Date;
  averageCycleTime: number;
  errorsSinceStart: number;
  lastError?: string;
};

// Global state for monitoring (simplified for this implementation)
let isRunning = false;
let startTime: Date | undefined;
let totalCycles = 0;
const cycleTimes: number[] = [];
let errorsEncountered = 0;
let monitoringInterval: NodeJS.Timeout | null = null;

const MONITORING_INTERVAL = 5000; // 5 seconds
const MAX_CYCLE_TIME_HISTORY = 100;

// Implementation
export const listingMonitor: ListingMonitorService = {
  // Start the background monitoring process
  startMonitoring: (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Starting listing monitor");

      if (isRunning) {
        throw new TradingError({
          message: "Listing monitor is already running",
          code: "MONITOR_ALREADY_RUNNING",
          timestamp: new Date(),
        });
      }

      try {
        // Initialize the listing detector
        yield* listingDetector.initialize();

        // Start monitoring
        isRunning = true;
        startTime = new Date();
        totalCycles = 1;
        errorsEncountered = 0;

        yield* TradingLogger.logInfo("Listing monitor started successfully");

        // Start the monitoring loop
        yield* startMonitoringLoop();
      } catch (error) {
        yield* TradingLogger.logError("Failed to start listing monitor", error);
        throw new TradingError({
          message: "Failed to start listing monitor",
          code: "MONITOR_START_FAILED",
          timestamp: new Date(),
        });
      }
    });
  },

  // Stop the background monitoring process
  stopMonitoring: (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Stopping listing monitor");

      if (!isRunning) {
        yield* TradingLogger.logWarning("Listing monitor is not running");
        return;
      }

      try {
        // Clear the monitoring interval
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          monitoringInterval = null;
        }

        // Stop the listing detector
        yield* listingDetector.shutdown();

        // Update state
        isRunning = false;

        yield* TradingLogger.logInfo("Listing monitor stopped successfully");
      } catch (error) {
        yield* TradingLogger.logError("Failed to stop listing monitor", error);
        throw new TradingError({
          message: "Failed to stop listing monitor",
          code: "MONITOR_STOP_FAILED",
          timestamp: new Date(),
        });
      }
    });
  },

  // Check if monitoring is currently active
  isMonitoring: () => Effect.succeed(isRunning),

  // Get current monitoring statistics
  getMonitoringStats: () =>
    Effect.succeed({
      isRunning,
      startTime,
      totalCycles,
      lastCycleTime,
      averageCycleTime:
        cycleTimes.length > 0
          ? cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length
          : 0,
      errorsSinceStart: errorsEncountered,
    }),
};

// Internal function to start the monitoring loop
const startMonitoringLoop = (): Effect.Effect<void, TradingError> => {
  return Effect.gen(function* () {
    yield* TradingLogger.logInfo("Starting monitoring loop");

    // Set up the interval for periodic monitoring
    monitoringInterval = setInterval(() => {
      // This is simplified - in a real implementation,
      // this would be wrapped in Effect properly
      performMonitoringCycle().catch((error) => {
        errorsEncountered += 1;
        TradingLogger.logError("Monitoring cycle failed", error);
      });
    }, MONITORING_INTERVAL);

    yield* TradingLogger.logInfo("Monitoring loop started");
  });
};

// Internal function to perform a single monitoring cycle
const performMonitoringCycle = async (): Promise<void> => {
  const cycleStartTime = Date.now();

  try {
    // Run the listing detector
    await Effect.runPromise(listingDetector.checkForNewListings());

    // Update statistics
    totalCycles += 1;
    lastCycleTime = new Date();
    const cycleTime = Date.now() - cycleStartTime;

    // Keep cycle time history limited
    cycleTimes.push(cycleTime);
    if (cycleTimes.length > MAX_CYCLE_TIME_HISTORY) {
      cycleTimes.shift();
    }

    await Effect.runPromise(
      TradingLogger.logDebug(`Monitoring cycle completed in ${cycleTime}ms`)
    );
  } catch (error) {
    errorsEncountered++;
    await Effect.runPromise(
      TradingLogger.logError("Monitoring cycle failed", error)
    );
    throw error;
  }
};

// Health check function
export const healthCheck = (): Effect.Effect<
  {
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    recommendations: string[];
  },
  TradingError
> => {
  return Effect.gen(function* () {
    const stats = yield* listingMonitor.getMonitoringStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if monitoring is running
    if (!stats.isRunning) {
      issues.push("Listing monitor is not running");
      recommendations.push("Start the listing monitor");
    }

    // Check error rate
    if (stats.errorsSinceStart > 0) {
      const errorRate = stats.errorsSinceStart / Math.max(stats.totalCycles, 1);
      if (errorRate > 0.1) {
        issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
        recommendations.push("Check logs for error patterns");
      }
    }

    // Check cycle time
    if (stats.averageCycleTime > 10_000) {
      // 10 seconds
      issues.push(
        `Slow average cycle time: ${stats.averageCycleTime.toFixed(0)}ms`
      );
      recommendations.push("Optimize monitoring cycle performance");
    }

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (issues.length > 0) {
      status = issues.length > 2 ? "unhealthy" : "degraded";
    }

    return {
      status,
      issues,
      recommendations,
    };
  });
};

// Layer for dependency injection
export const ListingMonitorLayer = Layer.succeed(
  ListingMonitorServiceTag,
  listingMonitor
);

/**
 * Usage Example:
 *
 * ```typescript
 * // Start monitoring
 * await Effect.runPromise(listingMonitor.startMonitoring());
 *
 * // Check status
 * const stats = await Effect.runPromise(listingMonitor.getMonitoringStats());
 * console.log("Monitoring stats:", stats);
 *
 * // Stop monitoring
 * await Effect.runPromise(listingMonitor.stopMonitoring());
 * ```
 */
