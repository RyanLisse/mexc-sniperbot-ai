"use client";

import {
  Activity,
  Clock,
  DollarSign,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PerformanceMetricsData = {
  window: "1h" | "6h" | "24h" | "7d";
  trades: number;
  successRate: number;
  averageExecutionTimeMs: number;
  volume: number;
};

type PerformanceMetricsProps = {
  metrics: PerformanceMetricsData;
  isLoading?: boolean;
  onWindowChange?: (window: "1h" | "6h" | "24h" | "7d") => void;
};

export function PerformanceMetrics({
  metrics,
  isLoading,
  onWindowChange,
}: PerformanceMetricsProps) {
  const [selectedWindow, setSelectedWindow] = useState<
    "1h" | "6h" | "24h" | "7d"
  >(metrics.window ?? "24h");

  const handleWindowChange = (value: string) => {
    const window = value as "1h" | "6h" | "24h" | "7d";
    setSelectedWindow(window);
    onWindowChange?.(window);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>
            Trade execution performance statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Activity className="mx-auto mb-2 h-8 w-8 animate-spin opacity-50" />
            <p>Loading performance metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Trade execution performance statistics
            </CardDescription>
          </div>
          <Select onValueChange={handleWindowChange} value={selectedWindow}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Trades */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Total Trades
              </span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-bold text-2xl">{metrics.trades}</div>
            <div className="text-muted-foreground text-xs">
              in {selectedWindow}
            </div>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Success Rate
              </span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-bold text-2xl">
              {metrics.successRate.toFixed(1)}%
            </div>
            <div className="space-y-1">
              <Progress className="h-2" value={metrics.successRate} />
              <div className="text-muted-foreground text-xs">
                {metrics.successRate >= 90
                  ? "Excellent"
                  : metrics.successRate >= 70
                    ? "Good"
                    : "Needs Improvement"}
              </div>
            </div>
          </div>

          {/* Average Execution Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Avg Execution
              </span>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-bold text-2xl">
              {metrics.averageExecutionTimeMs}ms
            </div>
            <div className="space-y-1">
              <Badge
                className="text-xs"
                variant={
                  metrics.averageExecutionTimeMs < 100 ? "default" : "secondary"
                }
              >
                {metrics.averageExecutionTimeMs < 100 ? (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Fast
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Normal
                  </span>
                )}
              </Badge>
            </div>
          </div>

          {/* Total Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Total Volume
              </span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-bold text-2xl">
              ${metrics.volume.toFixed(2)}
            </div>
            <div className="text-muted-foreground text-xs">
              {metrics.trades > 0
                ? `Avg: $${(metrics.volume / metrics.trades).toFixed(2)}`
                : "No trades"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
