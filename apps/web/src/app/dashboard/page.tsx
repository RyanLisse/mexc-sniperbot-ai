"use client";

import type { DashboardPerformanceWindow } from "@mexc-sniperbot-ai/api";
import { useState } from "react";
import { Alerts } from "@/components/alerts";
import { BotStatus } from "@/components/bot-status";
import { ListingEvents } from "@/components/listing-events";
import { PerformanceMetrics } from "@/components/performance-metrics";
import { PortfolioValueCard } from "@/components/portfolio-value-card";
import { PositionsTable } from "@/components/positions-table";
import { TradeHistory } from "@/components/trade-history";
import {
  useAlertsSubscription,
  useDashboardSubscription,
  usePerformanceMetricsSubscription,
} from "@/hooks/use-subscriptions";

export default function Dashboard() {
  const [performanceWindow, setPerformanceWindow] =
    useState<DashboardPerformanceWindow>("24h");

  const { snapshot, isLoading: snapshotLoading } = useDashboardSubscription({
    enabled: true,
    refetchInterval: 5000,
  });

  const { data: performanceData, isLoading: performanceLoading } =
    usePerformanceMetricsSubscription(performanceWindow);

  const { data: alertsData, isLoading: alertsLoading } =
    useAlertsSubscription(5);

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            MEXC Sniper Bot Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Real-time monitoring and trading activity
          </p>
        </div>
      </div>

      {/* Portfolio Value Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PortfolioValueCard />
      </div>

      {/* Alerts Section - Show critical alerts at top */}
      {alertsData?.success && alertsData.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <Alerts alerts={alertsData.data} isLoading={alertsLoading} />
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-4">
        <PerformanceMetrics
          isLoading={performanceLoading}
          metrics={
            performanceData?.success && performanceData.data
              ? performanceData.data
              : {
                  window: performanceWindow,
                  trades: 0,
                  successRate: 0,
                  averageExecutionTimeMs: 0,
                  volume: 0,
                }
          }
          onWindowChange={setPerformanceWindow}
        />
      </div>

      {/* Open Positions */}
      <div className="grid grid-cols-1 gap-4">
        <PositionsTable />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Bot Status */}
          <BotStatus />

          {/* Trade History */}
          <TradeHistory
            isLoading={snapshotLoading}
            trades={snapshot?.trades ?? []}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Listing Events */}
          <ListingEvents />

          {/* Alerts (if not shown at top) */}
          {(!alertsData?.success || alertsData.data.length === 0) && (
            <Alerts alerts={[]} isLoading={alertsLoading} />
          )}
        </div>
      </div>
    </div>
  );
}
