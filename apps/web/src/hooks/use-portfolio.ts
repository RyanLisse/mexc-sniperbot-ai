"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function usePortfolioValue() {
  return useQuery(
    trpc.portfolio.getPortfolioValue.queryOptions(undefined, {
      refetchInterval: 10_000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
    })
  );
}

export function usePortfolioPerformance(
  window: "1D" | "1W" | "1M" | "3M" = "1D"
) {
  return useQuery(
    trpc.portfolio.getPortfolioPerformance.queryOptions(
      { window },
      {
        refetchInterval: 30_000, // Refresh every 30 seconds
        refetchOnWindowFocus: true,
      }
    )
  );
}

export function useAccountBalance() {
  return useQuery(
    trpc.portfolio.getBalance.queryOptions(undefined, {
      refetchInterval: 10_000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
    })
  );
}

export function usePortfolioMetrics() {
  return useQuery(
    trpc.portfolio.getPortfolioMetrics.queryOptions(undefined, {
      refetchInterval: 10_000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
    })
  );
}
