"use client";

import type { DashboardSnapshot } from "@mexc-sniperbot-ai/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

type SubscriptionOptions = {
  enabled?: boolean;
  refetchInterval?: number;
  onUpdate?: (snapshot: DashboardSnapshot) => void;
};

export function useDashboardSubscription(options: SubscriptionOptions = {}) {
  const { enabled = true, refetchInterval = 5000, onUpdate } = options;
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  const _intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref when callback changes
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const { data, isLoading, error, refetch } = useQuery(
    trpc.dashboard.getSnapshot.queryOptions(
      { limit: 25 },
      {
        enabled,
        refetchInterval: enabled ? refetchInterval : false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  );

  // Update snapshot when data changes
  useEffect(() => {
    if (data?.success && data.data) {
      const normalizedSnapshot: DashboardSnapshot = {
        ...data.data,
        trades: data.data.trades.map((trade) => ({
          ...trade,
          completedAt: trade.completedAt ?? undefined,
          errorCode: trade.errorCode ?? undefined,
          errorMessage: trade.errorMessage ?? undefined,
        })),
      };

      setSnapshot(normalizedSnapshot);
      setIsConnected(true);
      onUpdateRef.current?.(normalizedSnapshot);
    }
  }, [data]);

  // Handle connection status
  useEffect(() => {
    if (error) {
      setIsConnected(false);
    }
  }, [error]);

  const manualRefresh = useCallback(() => refetch(), [refetch]);

  return {
    snapshot,
    isLoading,
    error,
    isConnected,
    refetch: manualRefresh,
  };
}

export function useTradeHistorySubscription(limit = 25) {
  return useQuery(
    trpc.dashboard.getTradeHistory.queryOptions(
      { limit },
      {
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  );
}

export function usePerformanceMetricsSubscription(
  window: "1h" | "6h" | "24h" | "7d" = "24h"
) {
  return useQuery(
    trpc.dashboard.getPerformanceMetrics.queryOptions(
      { window },
      {
        refetchInterval: 10_000, // Refresh every 10 seconds
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  );
}

export function useAlertsSubscription(limit = 5) {
  return useQuery(
    trpc.dashboard.getAlerts.queryOptions(
      { limit },
      {
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  );
}

export function useListingsSubscription(limit = 10) {
  return useQuery(
    trpc.dashboard.getListings.queryOptions(
      { limit },
      {
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    )
  );
}
