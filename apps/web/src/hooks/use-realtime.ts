import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { tradingKeys } from "./use-trading";

/* ============================================================================
 * Types
 * ==========================================================================*/

// Discriminated union for all WebSocket messages
export type WebSocketMessage =
  | TradeUpdateMessage
  | BotStatusMessage
  | ListingDetectedMessage
  | SystemAlertMessage
  | PerformanceMetricMessage;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type RealTimeOptions = {
  autoReconnect?: boolean;
  /** ms between reconnect attempts (used as base; we apply exp backoff + jitter) */
  reconnectInterval?: number;
  /** max reconnect attempts before giving up (set Infinity for unbounded) */
  maxReconnectAttempts?: number;
  /** surface toast notifications for key events */
  enableNotifications?: boolean;
  /** optional native protocols argument for WebSocket ctor */
  protocols?: string | string[];
  /** tap into the raw parsed message stream */
  onMessage?: (msg: WebSocketMessage) => void;
};

// Message: trade_update
export type TradeUpdateMessage = {
  type: "trade_update";
  data: {
    id: string;
    symbol: string;
    status: "SUCCESS" | "FAILED" | "PENDING";
    strategy: "MARKET" | "LIMIT";
    executedPrice?: string;
    executedQuantity?: string;
    executionTime: number;
    value: number;
  };
  timestamp: string; // ISO
};

// Message: bot_status
export type BotStatusMessage = {
  type: "bot_status";
  data: {
    isRunning: boolean;
    lastHeartbeat: string; // ISO
    mexcApiStatus: string;
    apiResponseTime: number;
    uptime: number;
  };
  timestamp: string; // ISO
};

// Message: listing_detected
export type ListingDetectedMessage = {
  type: "listing_detected";
  data: {
    id: string;
    symbol: string;
    price: string;
    detectedAt: string; // ISO
    metadata: {
      detectionMethod: string;
      volume?: string;
      change24h?: string;
    };
  };
  timestamp: string; // ISO
};

// Message: system_alert
export type SystemAlertMessage = {
  type: "system_alert";
  data: {
    severity: "low" | "medium" | "high" | "critical";
    component: string;
    message: string;
    action?: string;
  };
  timestamp: string; // ISO
};

// Message: performance_metric
export type PerformanceMetricMessage = {
  type: "performance_metric";
  data: {
    executionTime: number;
    successRate: number;
    apiResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  timestamp: string; // ISO
};

/* ============================================================================
 * Internal: type guards (lightweight runtime validation)
 * ==========================================================================*/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number";
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

const hasLiteral = <T extends string>(
  v: unknown,
  ...values: readonly T[]
): v is T => isString(v) && (values as readonly string[]).includes(v);

function asMessage(maybe: unknown): WebSocketMessage | null {
  if (!(isRecord(maybe) && isString(maybe.type))) {
    return null;
  }
  const t = maybe.type;

  if (t === "trade_update") {
    if (!isRecord(maybe.data)) {
      return null;
    }
    const d = maybe.data;
    if (
      isString(d.id) &&
      isString(d.symbol) &&
      hasLiteral(d.status, "SUCCESS", "FAILED", "PENDING") &&
      hasLiteral(d.strategy, "MARKET", "LIMIT") &&
      isNumber(d.executionTime) &&
      isNumber(d.value) &&
      isString(maybe.timestamp)
    ) {
      return maybe as TradeUpdateMessage;
    }
  }

  if (t === "bot_status") {
    if (!isRecord(maybe.data)) {
      return null;
    }
    const d = maybe.data;
    if (
      isBoolean(d.isRunning) &&
      isString(d.lastHeartbeat) &&
      isString(d.mexcApiStatus) &&
      isString(d.mexcApiStatus) &&
      isNumber(d.apiResponseTime) &&
      isNumber(d.uptime) &&
      isString(maybe.timestamp)
    ) {
      return maybe as BotStatusMessage;
    }
  }

  if (t === "listing_detected") {
    if (!isRecord(maybe.data)) {
      return null;
    }
    const d = maybe.data;
    if (
      isString(d.id) &&
      isString(d.symbol) &&
      isString(d.price) &&
      isString(d.detectedAt) &&
      isRecord(d.metadata) &&
      isString(d.metadata.detectionMethod) &&
      isString(maybe.timestamp)
    ) {
      return maybe as ListingDetectedMessage;
    }
  }

  if (t === "system_alert") {
    if (!isRecord(maybe.data)) {
      return null;
    }
    const d = maybe.data;
    if (
      hasLiteral(d.severity, "low", "medium", "high", "critical") &&
      isString(d.component) &&
      isString(d.message) &&
      isString(maybe.timestamp)
    ) {
      return maybe as SystemAlertMessage;
    }
  }

  if (t === "performance_metric") {
    if (!isRecord(maybe.data)) {
      return null;
    }
    const d = maybe.data;
    if (
      isNumber(d.executionTime) &&
      isNumber(d.successRate) &&
      isNumber(d.apiResponseTime) &&
      isNumber(d.memoryUsage) &&
      isNumber(d.cpuUsage) &&
      isString(maybe.timestamp)
    ) {
      return maybe as PerformanceMetricMessage;
    }
  }

  return null;
}

/* ============================================================================
 * Utils
 * ==========================================================================*/

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/** exp backoff with jitter */
function nextDelay(baseMs: number, attempt: number, maxMs = 30_000) {
  const exp = baseMs * 2 ** clamp(attempt, 0, 10);
  const jitter = Math.random() * baseMs;
  return clamp(exp + jitter, baseMs, maxMs);
}

const joinWs = (base: string, tail?: string) => {
  if (!tail) {
    return base;
  }
  const a = base.replace(/\/+$/, "");
  const b = tail.replace(/^\/+/, "");
  return `${a}/${b}`;
};

/* ============================================================================
 * useWebSocket (single source of truth)
 * ==========================================================================*/

export const useWebSocket = (url: string, options: RealTimeOptions = {}) => {
  const {
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enableNotifications = true,
    protocols,
    onMessage,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const manualCloseRef = useRef(false); // distinguish user-triggered close
  const reconnectTimerRef = useRef<number | null>(null);

  const queryClient = useQueryClient();

  const clearTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const closeSocket = useCallback(
    (code = 1000, reason?: string) => {
      clearTimer();
      if (wsRef.current) {
        try {
          wsRef.current.close(code, reason);
        } catch {
          // ignore
        } finally {
          wsRef.current = null;
        }
      }
    },
    [clearTimer]
  );

  const handleTradeUpdate = useCallback(
    (message: TradeUpdateMessage) => {
      // Safe cache update: keep latest 50 trades if shape matches
      queryClient.setQueryData(tradingKeys.history(), (old: any) => {
        if (old && Array.isArray(old.trades)) {
          return {
            ...old,
            trades: [message.data, ...old.trades].slice(0, 50),
          };
        }
        return old;
      });

      // refresh derived stats
      queryClient.invalidateQueries({ queryKey: tradingKeys.stats() });

      if (!enableNotifications) {
        return;
      }

      if (message.data.status === "SUCCESS") {
        toast.success(`Trade executed: ${message.data.symbol}`, {
          description: `Value: $${message.data.value.toFixed(2)}`,
        });
      } else if (message.data.status === "FAILED") {
        toast.error(`Trade failed: ${message.data.symbol}`);
      }
    },
    [queryClient, enableNotifications]
  );

  const handleBotStatus = useCallback(
    (message: BotStatusMessage) => {
      queryClient.setQueryData(tradingKeys.botStatus(), message.data);

      if (!enableNotifications) {
        return;
      }
      if (message.data.isRunning) {
        toast.info("Bot started");
      } else {
        toast.warning("Bot stopped");
      }
    },
    [queryClient, enableNotifications]
  );

  const handleListing = useCallback(
    (message: ListingDetectedMessage) => {
      queryClient.setQueryData(tradingKeys.listings(), (old: any) => {
        if (old && Array.isArray(old.listings)) {
          return {
            ...old,
            listings: [message.data, ...old.listings].slice(0, 50),
          };
        }
        return old;
      });

      if (enableNotifications) {
        toast.success(`New listing: ${message.data.symbol}`, {
          description: `Price: $${message.data.price}`,
        });
      }
    },
    [queryClient, enableNotifications]
  );

  const handleSystemAlert = useCallback(
    (message: SystemAlertMessage) => {
      if (!enableNotifications) {
        return;
      }
      const s = message.data.severity;
      const fn =
        s === "critical" || s === "high"
          ? toast.error
          : s === "medium"
            ? toast.warning
            : toast.info;
      fn(message.data.message, { description: message.data.component });
    },
    [enableNotifications]
  );

  const routeMessage = useCallback(
    (msg: WebSocketMessage) => {
      setLastMessage(msg);
      onMessage?.(msg);

      switch (msg.type) {
        case "trade_update":
          handleTradeUpdate(msg);
          break;
        case "bot_status":
          handleBotStatus(msg);
          break;
        case "listing_detected":
          handleListing(msg);
          break;
        case "system_alert":
          handleSystemAlert(msg);
          break;
        case "performance_metric":
          // no default cache action; hooks may opt-in via onMessage
          break;
        default:
          // exhaustive check
          ((_: never) => _)(msg);
      }
    },
    [
      onMessage,
      handleTradeUpdate,
      handleBotStatus,
      handleListing,
      handleSystemAlert,
    ]
  );

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    manualCloseRef.current = false;
    setStatus("connecting");

    try {
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setReconnectAttempts(0);
        if (enableNotifications) {
          console.log("[WS] connected:", url);
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data);
          const msg = asMessage(parsed);
          if (msg) {
            routeMessage(msg);
          } else {
            console.warn("[WS] unknown payload:", parsed);
          }
        } catch (e) {
          console.error("[WS] parse error:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[WS] error:", err);
        setStatus("error");
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        setStatus("disconnected");

        // normal close or manual close -> don't reconnect
        if (manualCloseRef.current || ev.code === 1000) {
          return;
        }

        if (!autoReconnect) {
          return;
        }

        const nextAttempt = reconnectAttempts + 1;
        if (nextAttempt > maxReconnectAttempts) {
          return;
        }

        const delay = nextDelay(reconnectInterval, reconnectAttempts);
        if (enableNotifications) {
          console.log(
            `[WS] disconnected; retry ${nextAttempt}/${maxReconnectAttempts} in ${Math.round(
              delay
            )}ms`
          );
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          setReconnectAttempts(nextAttempt);
          connect();
        }, delay);
      };
    } catch (e) {
      console.error("[WS] create failed:", e);
      setStatus("error");
    }
  }, [
    url,
    protocols,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
    reconnectAttempts,
    enableNotifications,
    routeMessage,
  ]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    closeSocket(1000, "User disconnected");
    setStatus("disconnected");
  }, [closeSocket]);

  const send = useCallback((data: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      wsRef.current.send(
        typeof data === "string" ? data : JSON.stringify(data)
      );
      return true;
    } catch (e) {
      console.error("[WS] send failed:", e);
      return false;
    }
  }, []);

  // Lifecycle
  useEffect(() => {
    connect();
    return () => {
      disconnect();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, clearTimer, disconnect]); // (disconnect is stable)

  const isConnected = status === "connected";

  return {
    status,
    isConnected,
    connect,
    disconnect,
    send,
    lastMessage,
  };
};

/* ============================================================================
 * Feature Hooks (composable on top of useWebSocket)
 * ==========================================================================*/

export const useRealTimeTrading = (options: RealTimeOptions = {}) => {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  const { status, isConnected } = useWebSocket(wsUrl, options);

  return useMemo(
    () => ({
      status,
      isConnected,
      connectionStatus: status,
    }),
    [status, isConnected]
  );
};

export const useRealTimeBotMonitoring = (options: RealTimeOptions = {}) => {
  const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  const wsUrl = joinWs(base, "bot");

  const { status, isConnected } = useWebSocket(wsUrl, {
    ...options,
    enableNotifications: options.enableNotifications ?? true,
  });

  return useMemo(
    () => ({
      status,
      isConnected,
      connectionStatus: status,
    }),
    [status, isConnected]
  );
};

export const useRealTimeAlerts = (options: RealTimeOptions = {}) => {
  const [alerts, setAlerts] = useState<SystemAlertMessage[]>([]);
  const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  const wsUrl = joinWs(base, "alerts");

  const { status, isConnected } = useWebSocket(wsUrl, {
    ...options,
    enableNotifications: options.enableNotifications ?? true,
    onMessage: (msg) => {
      if (msg.type === "system_alert") {
        setAlerts((prev) => [msg, ...prev].slice(0, 100));
      }
    },
  });

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return useMemo(
    () => ({
      alerts,
      status,
      isConnected,
      clearAlerts,
    }),
    [alerts, status, isConnected, clearAlerts]
  );
};

export const useRealTimePerformance = (options: RealTimeOptions = {}) => {
  const [metrics, setMetrics] = useState<PerformanceMetricMessage[]>([]);
  const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  const wsUrl = joinWs(base, "performance");

  const { status, isConnected } = useWebSocket(wsUrl, {
    ...options,
    onMessage: (msg) => {
      if (msg.type === "performance_metric") {
        setMetrics((prev) => [msg, ...prev].slice(0, 60)); // ~ last hour if 1/min
      }
    },
  });

  const averageMetrics =
    metrics.length > 0
      ? {
          executionTime:
            metrics.reduce((sum, m) => sum + m.data.executionTime, 0) /
            metrics.length,
          successRate:
            metrics.reduce((sum, m) => sum + m.data.successRate, 0) /
            metrics.length,
          apiResponseTime:
            metrics.reduce((sum, m) => sum + m.data.apiResponseTime, 0) /
            metrics.length,
          memoryUsage:
            metrics.reduce((sum, m) => sum + m.data.memoryUsage, 0) /
            metrics.length,
          cpuUsage:
            metrics.reduce((sum, m) => sum + m.data.cpuUsage, 0) /
            metrics.length,
        }
      : null;

  const clearMetrics = useCallback(() => setMetrics([]), []);

  return useMemo(
    () => ({
      metrics,
      averageMetrics,
      status,
      isConnected,
      clearMetrics,
    }),
    [metrics, averageMetrics, status, isConnected, clearMetrics]
  );
};

export const useRealTimeConnection = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const queryClient = useQueryClient();

  const enableRealTime = useCallback(() => {
    setIsEnabled(true);
    // invalidate all trading queries (best-effort: matches user’s existing key factory)
    queryClient.invalidateQueries({ queryKey: tradingKeys.all });
  }, [queryClient]);

  const disableRealTime = useCallback(() => {
    setIsEnabled(false);
  }, []);

  return useMemo(
    () => ({
      isEnabled,
      enableRealTime,
      disableRealTime,
    }),
    [isEnabled, enableRealTime, disableRealTime]
  );
};

export const useRealTimeWithFallback = (
  wsUrl: string,
  pollingQuery: () => Promise<unknown>,
  queryKey: readonly unknown[],
  options: RealTimeOptions & { pollingInterval?: number } = {}
) => {
  const { pollingInterval = 5000, ...wsOptions } = options;
  const { status, isConnected } = useWebSocket(wsUrl, wsOptions);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isConnected) {
      return;
    }

    let cancelled = false;
    const id = window.setInterval(() => {
      pollingQuery()
        .then((data) => {
          if (!cancelled) {
            queryClient.setQueryData(queryKey, data);
          }
        })
        .catch((err) => console.error("[Polling] failed:", err));
    }, pollingInterval);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isConnected, pollingQuery, queryKey, pollingInterval, queryClient]);

  return useMemo(
    () => ({
      status,
      isConnected,
      connectionType: isConnected ? "websocket" : ("polling" as const),
    }),
    [status, isConnected]
  );
};

/* ============================================================================
 * Public exports
 * ==========================================================================*/

export { useWebSocket as _useWebSocketInternal };
