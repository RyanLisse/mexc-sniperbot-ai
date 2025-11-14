"use client";

import { BotStatus } from "@/components/bot-status";
import { ErrorBoundary } from "@/components/error-boundary";
import { TradeHistory } from "@/components/trade-history";
import { useDashboardSubscription } from "@/hooks/use-subscriptions";

export default function TradingPage() {
  const { snapshot, isLoading } = useDashboardSubscription({
    enabled: true,
    refetchInterval: 5000,
  });

  return (
    <ErrorBoundary>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Trading</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor and control trading operations
          </p>
        </div>

        {/* Bot Status */}
        <BotStatus />

        {/* Trade History */}
        <TradeHistory isLoading={isLoading} trades={snapshot?.trades ?? []} />
      </div>
    </ErrorBoundary>
  );
}
