"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle,
  Database,
  Globe,
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Mock data - will be replaced with real API calls
const mockBotStatus = {
  isRunning: true,
  lastHeartbeat: new Date(),
  mexcApiStatus: "HEALTHY",
  apiResponseTime: 234,
  uptime: 99.8,
  version: "1.0.0",
  startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
};

const mockSystemMetrics = {
  memoryUsage: 67,
  cpuUsage: 23,
  databaseConnections: 3,
  activeConnections: 10,
  errorRate: 1.2,
  requestsPerMinute: 45,
};

type BotStatusProps = {
  isRunning?: boolean;
  onToggle?: () => void;
};

export function BotStatus({
  isRunning: externalIsRunning,
  onToggle,
}: BotStatusProps) {
  const [botStatus, _setBotStatus] = useState(mockBotStatus);
  const [systemMetrics, _setSystemMetrics] = useState(mockSystemMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [isInternalRunning, setIsInternalRunning] = useState(
    mockBotStatus.isRunning
  );

  // Use external prop if provided, otherwise use internal state
  const isRunning =
    externalIsRunning !== undefined ? externalIsRunning : isInternalRunning;

  const fetchBotStatus = useCallback(async () => {
    await Promise.resolve(); // Add await expression
    try {
      // Replace with actual API calls
      // const [statusResponse, metricsResponse] = await Promise.all([
      //   fetch('/api/trading/bot-status'),
      //   fetch('/api/monitoring/system-status')
      // ]);
      // const statusData = await statusResponse.json();
      // const metricsData = await metricsResponse.json();
      // setBotStatus(statusData);
      // setSystemMetrics(metricsData);
      console.log("Bot status fetched (mock data currently)");
    } catch (error) {
      console.error("Failed to fetch bot status:", error);
    }
  }, []);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  const handleToggleBot = async () => {
    setIsLoading(true);
    try {
      // Replace with actual API call
      // const response = await fetch('/api/trading/control-bot', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ action: isRunning ? 'stop' : 'start' })
      // });
      // await response.json();

      if (onToggle) {
        onToggle();
      } else {
        setIsInternalRunning(!isInternalRunning);
      }

      await fetchBotStatus();
    } catch (error) {
      console.error("Failed to toggle bot:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return "default";
      case "DEGRADED":
        return "secondary";
      case "ERROR":
        return "destructive";
      default:
        return "outline";
    }
  };

  const _getProgressColor = (
    value: number,
    thresholds: { warning: number; danger: number }
  ) => {
    if (value >= thresholds.danger) {
      return "bg-red-500";
    }
    if (value >= thresholds.warning) {
      return "bg-yellow-500";
    }
    return "bg-green-500";
  };

  const _getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      );
    }
    if (isRunning) {
      return (
        <>
          <PowerOff className="mr-2 h-4 w-4" />
          Stop Bot
        </>
      );
    }
    return (
      <>
        <Power className="mr-2 h-4 w-4" />
        Start Bot
      </>
    );
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Activity className="h-5 w-5 text-green-500" />
            ) : (
              <PowerOff className="h-5 w-5 text-gray-500" />
            )}
            Bot Status
          </div>
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Running" : "Stopped"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time bot operational status and metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Control Button */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={handleToggleBot}
            variant={isRunning ? "destructive" : "default"}
          >
            {_getButtonContent()}
          </Button>
          <Button size="icon" variant="outline">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Status</span>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {isRunning ? "Operational" : "Stopped"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Uptime</span>
            <span className="text-sm">{formatUptime(botStatus.startTime)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Version</span>
            <Badge variant="outline">{botStatus.version}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Last Heartbeat</span>
            <span className="text-muted-foreground text-sm">
              {botStatus.lastHeartbeat.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* API Status */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-medium text-sm">
            <Globe className="h-4 w-4" />
            API Connectivity
          </h4>

          <div className="flex items-center justify-between">
            <span className="text-sm">MEXC API</span>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusColor(botStatus.mexcApiStatus)}>
                {botStatus.mexcApiStatus}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {botStatus.apiResponseTime}ms
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Response Time</span>
            <div className="flex w-24 items-center gap-2">
              <Progress
                className="flex-1"
                value={Math.min((botStatus.apiResponseTime / 1000) * 100, 100)}
              />
              <span className="w-12 text-right text-muted-foreground text-xs">
                {botStatus.apiResponseTime}ms
              </span>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-medium text-sm">
            <Activity className="h-4 w-4" />
            System Metrics
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Memory Usage</span>
              <div className="flex w-24 items-center gap-2">
                <Progress
                  className="flex-1"
                  value={systemMetrics.memoryUsage}
                />
                <span className="w-8 text-right text-muted-foreground text-xs">
                  {systemMetrics.memoryUsage}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">CPU Usage</span>
              <div className="flex w-24 items-center gap-2">
                <Progress className="flex-1" value={systemMetrics.cpuUsage} />
                <span className="w-8 text-right text-muted-foreground text-xs">
                  {systemMetrics.cpuUsage}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm">
                <Database className="h-3 w-3" />
                DB Connections
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {systemMetrics.databaseConnections}
                </span>
                <span className="text-muted-foreground text-xs">/ 10</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Error Rate</span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    systemMetrics.errorRate > 5 ? "destructive" : "default"
                  }
                >
                  {systemMetrics.errorRate}%
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-medium text-sm">
            <TrendingUp className="h-4 w-4" />
            Performance
          </h4>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requests/min</span>
              <span className="font-medium">
                {systemMetrics.requestsPerMinute}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Response</span>
              <span className="font-medium">{botStatus.apiResponseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium text-green-600">
                {(100 - systemMetrics.errorRate).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium">{botStatus.uptime}%</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {systemMetrics.errorRate > 5 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">High Error Rate</span>
            </div>
            <p className="mt-1 text-red-700 text-xs">
              Error rate is {systemMetrics.errorRate}%. Consider investigating
              the issue.
            </p>
          </div>
        )}

        {botStatus.apiResponseTime > 1000 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Slow API Response</span>
            </div>
            <p className="mt-1 text-xs text-yellow-700">
              API response time is {botStatus.apiResponseTime}ms. Monitor
              closely.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
