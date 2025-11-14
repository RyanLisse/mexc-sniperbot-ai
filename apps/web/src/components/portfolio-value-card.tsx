"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

export function PortfolioValueCard() {
  const { data, isLoading, error } = useQuery(
    trpc.portfolio.getPortfolioValue.queryOptions(undefined, {
      refetchInterval: 10_000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
    })
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Error loading value</p>
        </CardContent>
      </Card>
    );
  }

  const value = data ?? 0;
  const change = 0.6; // Mock change percentage - in production, calculate from historical data
  const isPositive = change >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-3xl">
            $
            {value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <div
            className={`flex items-center gap-1 text-sm ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
