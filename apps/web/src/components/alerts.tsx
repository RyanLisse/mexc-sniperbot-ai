"use client";

import { AlertCircle, AlertTriangle, Bell, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type AlertItem = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  occurredAt: string;
};

type AlertsProps = {
  alerts: AlertItem[];
  isLoading?: boolean;
};

const getSeverityIcon = (severity: AlertItem["severity"]) => {
  switch (severity) {
    case "critical":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "high":
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    case "medium":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "low":
      return <Info className="h-5 w-5 text-blue-500" />;
  }
};

const getSeverityBadgeVariant = (
  severity: AlertItem["severity"]
): "default" | "destructive" | "secondary" => {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "default";
  }
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

export function Alerts({ alerts, isLoading }: AlertsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>System alerts and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 animate-pulse opacity-50" />
            <p>Loading alerts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high"
  );
  const hasCriticalAlerts = criticalAlerts.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>System alerts and notifications</CardDescription>
          </div>
          {hasCriticalAlerts && (
            <Badge className="animate-pulse" variant="destructive">
              {criticalAlerts.length} Critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No alerts at this time</p>
              <p className="text-sm">All systems operating normally</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  alert.severity === "critical" || alert.severity === "high"
                    ? "border-destructive/50 bg-destructive/5"
                    : "hover:bg-muted/50"
                }`}
                key={alert.id}
              >
                <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-medium text-sm">{alert.title}</h4>
                    <Badge
                      className="text-xs"
                      variant={getSeverityBadgeVariant(alert.severity)}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="mb-2 text-muted-foreground text-sm">
                    {alert.description}
                  </p>
                  <div className="text-muted-foreground text-xs">
                    {formatTimeAgo(alert.occurredAt)}
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
