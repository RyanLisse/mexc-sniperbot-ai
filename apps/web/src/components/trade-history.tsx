"use client";

import { AlertCircle, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type TradeHistoryItem = {
  id: string;
  symbol: string;
  status: string;
  strategy: string;
  quantity: number;
  price?: number;
  executedPrice?: number;
  executedQuantity?: number;
  createdAt: string;
  completedAt?: string;
  executionTimeMs: number;
  value: number;
  errorCode?: string;
  errorMessage?: string;
};

type TradeHistoryProps = {
  trades: TradeHistoryItem[];
  isLoading?: boolean;
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ago`;
};

const getStatusBadgeVariant = (
  status: string
): "default" | "destructive" | "secondary" => {
  switch (status) {
    case "SUCCESS":
    case "FILLED":
      return "default";
    case "FAILED":
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
};

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>Recent trading activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 animate-spin opacity-50" />
            <p>Loading trade history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade History</CardTitle>
        <CardDescription>
          Recent trading activity and execution results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trades.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No trades executed yet</p>
            </div>
          ) : (
            trades.map((trade) => (
              <div
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                key={trade.id}
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{trade.symbol}</span>
                    <Badge variant={getStatusBadgeVariant(trade.status)}>
                      {trade.status}
                    </Badge>
                    <Badge className="text-xs" variant="outline">
                      {trade.strategy}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <div className="flex items-center gap-4">
                      <span>
                        Qty:{" "}
                        {trade.executedQuantity?.toFixed(6) ??
                          trade.quantity.toFixed(6)}
                      </span>
                      {trade.executedPrice && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />@ $
                          {trade.executedPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {trade.errorMessage && (
                      <div className="flex items-center gap-1 text-destructive text-xs">
                        <AlertCircle className="h-3 w-3" />
                        {trade.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="mb-1 font-medium">
                    {trade.status === "SUCCESS" || trade.status === "FILLED" ? (
                      <span className="text-green-600">
                        ${trade.value.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(trade.createdAt)} • {trade.executionTimeMs}ms
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
