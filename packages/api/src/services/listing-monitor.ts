import { Effect, Layer, Context } from "effect";
import { listingDetector } from "./listing-detector";
import { tradingOrchestrator } from "./trading-orchestrator";
import { TradingError, TradingLogger } from "../lib/effect";

// Service interface for dependency injection
export type ListingMonitorService = {
  startMonitoring: () => Effect.Effect<void, TradingError>;
  stopMonitoring: () => Effect.Effect<void, TradingError>;
  isMonitoring: () => Effect.Effect<boolean, TradingError>;
  getMonitoringStats: () => Effect.Effect<MonitoringStats, TradingError>;
};

// Service tag
export const ListingMonitorService = Context.Tag<ListingMonitorService>("ListingMonitorService");

// Monitoring statistics type
export interface MonitoringStats {
  isRunning: boolean;
  startTime?: Date;
  totalCycles: number;
  lastCycleTime?: Date;
  averageCycleTime: number;
  newListingsDetected: number;
  errorsEncountered: number;
  uptime: number;
}

// Implementation class
export class ListingMonitor implements ListingMonitorService {
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime?: Date;
  private totalCycles = 0;
  private lastCycleTime?: Date;
  private cycleTimes: number[] = [];
  private newListingsDetected = 0;
  private errorsEncountered = 0;

  private readonly MONITORING_INTERVAL_MS = 5_000; // 5 seconds
  private readonly MAX_CYCLE_TIME_HISTORY = 100;

  // Start the background monitoring process
  startMonitoring = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Starting listing monitor");

      if (this.isRunning) {
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
        this.isRunning = true;
        this.startTime = new Date();
        this.totalCycles = 0;
        this.newListingsDetected = 0;
        this.errorsEncountered = 0;
        this.cycleTimes = [];

        // Start the monitoring loop
        this.startMonitoringLoop();

        yield* TradingLogger.logInfo("Listing monitor started successfully", {
          interval: this.MONITORING_INTERVAL_MS,
        });
      } catch (error) {
        // Stop monitoring if initialization failed
        this.isRunning = false;
        throw error instanceof TradingError 
          ? error 
          : new TradingError({
              message: `Failed to start listing monitor: ${error instanceof Error ? error.message : "Unknown error"}`,
              code: "MONITOR_START_FAILED",
              timestamp: new Date(),
            });
      }
    });
  };

  // Stop the background monitoring process
  stopMonitoring = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      yield* TradingLogger.logInfo("Stopping listing monitor");

      if (!this.isRunning) {
        throw new TradingError({
          message: "Listing monitor is not running",
          code: "MONITOR_NOT_RUNNING",
          timestamp: new Date(),
        });
      }

      try {
        // Stop the monitoring loop
        this.isRunning = false;
        if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
          this.monitoringInterval = null;
        }

        const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

        yield* TradingLogger.logInfo("Listing monitor stopped successfully", {
          totalCycles: this.totalCycles,
          uptime,
          newListingsDetected: this.newListingsDetected,
          errorsEncountered: this.errorsEncountered,
        });
      } catch (error) {
        throw new TradingError({
          message: `Failed to stop listing monitor: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "MONITOR_STOP_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Check if monitoring is currently active
  isMonitoring = (): Effect.Effect<boolean, TradingError> => {
    return Effect.sync(() => this.isRunning);
  };

  // Get monitoring statistics
  getMonitoringStats = (): Effect.Effect<MonitoringStats, TradingError> => {
    return Effect.gen(function* () {
      const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
      const averageCycleTime = this.cycleTimes.length > 0
        ? this.cycleTimes.reduce((sum, time) => sum + time, 0) / this.cycleTimes.length
        : 0;

      return {
        isRunning: this.isRunning,
        startTime: this.startTime,
        totalCycles: this.totalCycles,
        lastCycleTime: this.lastCycleTime,
        averageCycleTime,
        newListingsDetected: this.newListingsDetected,
        errorsEncountered: this.errorsEncountered,
        uptime,
      };
    });
  };

  // Private helper methods

  // Start the monitoring loop
  private startMonitoringLoop = (): void => {
    this.monitoringInterval = setInterval(async () => {
      if (this.isRunning) {
        Effect.runPromise(
          this.performMonitoringCycle().pipe(
            Effect.catchAll((error) => {
              this.errorsEncountered += 1;
              TradingLogger.logError("Monitoring cycle failed", error as Error);
              return Effect.void;
            })
          )
        );
      }
    }, this.MONITORING_INTERVAL_MS);
  };

  // Perform a single monitoring cycle
  private performMonitoringCycle = (): Effect.Effect<void, TradingError> => {
    return Effect.gen(function* () {
      const cycleStartTime = Date.now();

      try {
        yield* TradingLogger.logDebug("Starting monitoring cycle", {
          cycleNumber: this.totalCycles + 1,
        });

        // Process new listings through the orchestrator
        const successfulTrades = yield* tradingOrchestrator.processNewListings();

        // Update statistics
        this.totalCycles += 1;
        this.lastCycleTime = new Date();
        this.newListingsDetected += successfulTrades;

        const cycleTime = Date.now() - cycleStartTime;
        this.cycleTimes.push(cycleTime);

        // Keep only recent cycle times
        if (this.cycleTimes.length > this.MAX_CYCLE_TIME_HISTORY) {
          this.cycleTimes = this.cycleTimes.slice(-this.MAX_CYCLE_TIME_HISTORY);
        }

        yield* TradingLogger.logDebug("Monitoring cycle completed", {
          cycleNumber: this.totalCycles,
          cycleTime,
          successfulTrades,
          totalListingsDetected: this.newListingsDetected,
        });

        // Check if cycle is taking too long
        if (cycleTime > this.MONITORING_INTERVAL_MS * 0.8) {
          yield* TradingLogger.logWarn("Monitoring cycle taking longer than expected", {
            cycleTime,
            interval: this.MONITORING_INTERVAL_MS,
          });
        }
      } catch (error) {
        this.errorsEncountered += 1;
        
        const cycleTime = Date.now() - cycleStartTime;
        this.cycleTimes.push(cycleTime);

        yield* TradingLogger.logError("Monitoring cycle failed", error as Error, {
          cycleNumber: this.totalCycles + 1,
          cycleTime,
        });

        if (error instanceof TradingError) {
          throw error;
        }

        throw new TradingError({
          message: `Monitoring cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "MONITORING_CYCLE_FAILED",
          timestamp: new Date(),
        });
      }
    });
  };

  // Get detailed monitoring health
  getMonitoringHealth = (): Effect.Effect<{
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    recommendations: string[];
  }, TradingError> => {
    return Effect.gen(function* () {
      const stats = yield* this.getMonitoringStats();
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check error rate
      if (stats.totalCycles > 0) {
        const errorRate = (stats.errorsEncountered / stats.totalCycles) * 100;
        if (errorRate > 10) {
          issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
          recommendations.push("Check API connectivity and system resources");
        }
      }

      // Check average cycle time
      if (stats.averageCycleTime > this.MONITORING_INTERVAL_MS * 0.7) {
        issues.push(`Slow cycle times: ${stats.averageCycleTime.toFixed(0)}ms average`);
        recommendations.push("Consider optimizing detection logic or increasing monitoring interval");
      }

      // Check if monitor has been running too long without restart
      if (stats.uptime > 24 * 60 * 60 * 1000) { // 24 hours
        issues.push("Monitor running for over 24 hours");
        recommendations.push("Consider periodic restarts for stability");
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

  // Reset monitoring statistics
  resetStats = (): Effect.Effect<void, TradingError> => {
    return Effect.sync(() => {
      this.totalCycles = 0;
      this.newListingsDetected = 0;
      this.errorsEncountered = 0;
      this.cycleTimes = [];
      this.lastCycleTime = undefined;
      
      TradingLogger.logInfo("Monitoring statistics reset");
    });
  };
}

// Create layer for dependency injection
export const ListingMonitorLive = Layer.succeed(
  ListingMonitorService,
  new ListingMonitor()
);

// Export singleton instance
export const listingMonitor = new ListingMonitor();
