"use client";

import { Activity, AlertCircle, Loader2, XCircle } from "lucide-react";
import type { BotStatus } from "@/hooks/use-bot-control";
import { cn } from "@/lib/utils";

type BotStatusIndicatorProps = {
  status: BotStatus;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
};

type StatusConfig = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  badgeClassName: string;
};

const STATUS_CONFIG: Record<BotStatus, StatusConfig> = {
  running: {
    label: "Running",
    icon: Activity,
    iconClassName: "text-green-600 dark:text-green-400",
    badgeClassName:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  starting: {
    label: "Starting",
    icon: Loader2,
    iconClassName: "text-blue-600 dark:text-blue-400 animate-spin",
    badgeClassName:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  stopping: {
    label: "Stopping",
    icon: Loader2,
    iconClassName: "text-orange-600 dark:text-orange-400 animate-spin",
    badgeClassName:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
  stopped: {
    label: "Stopped",
    icon: XCircle,
    iconClassName: "text-gray-600 dark:text-gray-400",
    badgeClassName:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    iconClassName: "text-red-600 dark:text-red-400",
    badgeClassName:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  },
};

const SIZE_CONFIG = {
  sm: {
    badge: "px-2 py-1 text-xs",
    icon: "h-3 w-3",
    gap: "gap-1",
  },
  md: {
    badge: "px-3 py-1.5 text-sm",
    icon: "h-4 w-4",
    gap: "gap-1.5",
  },
  lg: {
    badge: "px-4 py-2 text-base",
    icon: "h-5 w-5",
    gap: "gap-2",
  },
};

/**
 * Bot status indicator with color-coded badge and icon
 *
 * @example
 * ```tsx
 * <BotStatusIndicator status="running" showLabel />
 * <BotStatusIndicator status="failed" size="sm" />
 * ```
 */
export function BotStatusIndicator({
  status,
  className,
  showLabel = true,
  size = "md",
}: BotStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.badgeClassName,
        sizeConfig.badge,
        sizeConfig.gap,
        className
      )}
    >
      <Icon className={cn(sizeConfig.icon, config.iconClassName)} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

/**
 * Simple status dot indicator (minimal variant)
 */
export function BotStatusDot({
  status,
  className,
}: {
  status: BotStatus;
  className?: string;
}) {
  return (
    <div className={cn("relative flex h-3 w-3", className)}>
      {(status === "running" || status === "starting") && (
        <>
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              status === "running" ? "bg-green-400" : "bg-blue-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-3 w-3 rounded-full",
              status === "running" ? "bg-green-500" : "bg-blue-500"
            )}
          />
        </>
      )}
      {status === "stopped" && (
        <span className="relative inline-flex h-3 w-3 rounded-full bg-gray-400" />
      )}
      {status === "failed" && (
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      )}
      {status === "stopping" && (
        <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
      )}
    </div>
  );
}

/**
 * Extended status display with heartbeat and uptime
 */
export function BotStatusExtended({
  status,
  lastHeartbeat,
  startedAt,
  errorMessage,
  className,
}: {
  status: BotStatus;
  lastHeartbeat?: string;
  startedAt?: string;
  errorMessage?: string;
  className?: string;
}) {
  const formatDuration = (start: string): string => {
    const ms = Date.now() - new Date(start).getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatHeartbeat = (heartbeat: string): string => {
    const seconds = Math.floor(
      (Date.now() - new Date(heartbeat).getTime()) / 1000
    );
    if (seconds < 10) {
      return "Just now";
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <BotStatusIndicator status={status} />
        {errorMessage && status === "failed" && (
          <span className="text-red-600 text-sm dark:text-red-400">
            {errorMessage}
          </span>
        )}
      </div>

      <div className="text-gray-600 text-sm dark:text-gray-400">
        {startedAt && (status === "running" || status === "starting") && (
          <div>
            <span className="font-medium">Uptime:</span>{" "}
            {formatDuration(startedAt)}
          </div>
        )}
        {lastHeartbeat && status === "running" && (
          <div>
            <span className="font-medium">Last heartbeat:</span>{" "}
            {formatHeartbeat(lastHeartbeat)}
          </div>
        )}
      </div>
    </div>
  );
}
