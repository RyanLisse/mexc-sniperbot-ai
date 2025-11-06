import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tradingKeys } from "./use-trading";

// Types for WebSocket messages
type WebSocketMessage = {
  type: "trade_update" | "bot_status" | "listing_detected" | "system_alert" | "performance_metric";
  data: unknown;
  timestamp: string;
};

type TradeUpdateMessage = {
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
  timestamp: string;
};

type BotStatusMessage = {
  type: "bot_status";
  data: {
    isRunning: boolean;
    lastHeartbeat: string;
    mexcApiStatus: string;
    apiResponseTime: number;
    uptime: number;
  };
  timestamp: string;
};

type ListingDetectedMessage = {
  type: "listing_detected";
  data: {
    id: string;
    symbol: string;
    price: string;
    detectedAt: string;
    metadata: {
      detectionMethod: string;
      volume?: string;
      change24h?: string;
    };
  };
  timestamp: string;
};

type SystemAlertMessage = {
  type: "system_alert";
  data: {
    severity: "low" | "medium" | "high" | "critical";
    component: string;
    message: string;
    action?: string;
  };
  timestamp: string;
};

type PerformanceMetricMessage = {
  type: "performance_metric";
  data: {
    executionTime: number;
    successRate: number;
    apiResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  timestamp: string;
};

// WebSocket connection status
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// Real-time subscription options
interface RealTimeOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableNotifications?: boolean;
}

// Custom hook for WebSocket connection
export const useWebSocket = (url: string, options: RealTimeOptions = {}) => {
  const {
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enableNotifications = true,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");
    
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setReconnectAttempts(0);
        console.log("WebSocket connected");
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        wsRef.current = null;
        
        if (event.code !== 1000 && autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          console.log(`WebSocket disconnected, attempting reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        setStatus("error");
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

    } catch (error) {
      setStatus("error");
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "trade_update":
        handleTradeUpdate(message as TradeUpdateMessage);
        break;
      case "bot_status":
        handleBotStatusUpdate(message as BotStatusMessage);
        break;
      case "listing_detected":
        handleListingDetected(message as ListingDetectedMessage);
        break;
      case "system_alert":
        handleSystemAlert(message as SystemAlertMessage);
        break;
      case "performance_metric":
        handlePerformanceMetric(message as PerformanceMetricMessage);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  }, []);

  const handleTradeUpdate = useCallback((message: TradeUpdateMessage) => {
    // Update trade history cache
    queryClient.setQueryData(
      tradingKeys.history(),
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          trades: [message.data, ...(old.trades || []).slice(0, 49)], // Keep latest 50
        };
      }
    );

    // Update stats cache
    queryClient.invalidateQueries({ queryKey: tradingKeys.stats() });

    // Show notification for successful trades
    if (enableNotifications && message.data.status === "SUCCESS") {
      toast.success(`Trade executed: ${message.data.symbol}`, {
        description: `Value: $${message.data.value.toFixed(2)}`,
      });
    } else if (enableNotifications && message.data.status === "FAILED") {
      toast.error(`Trade failed: ${message.data.symbol}`);
    }
  }, [queryClient, enableNotifications]);

  const handleBotStatusUpdate = useCallback((message: BotStatusMessage) => {
    // Update bot status cache
    queryClient.setQueryData(tradingKeys.botStatus(), message.data);

    // Show notification for bot status changes
    if (enableNotifications) {
      if (message.data.isRunning) {
        toast.info("Bot started successfully");
      } else {
        toast.warning("Bot stopped");
      }
    }
  }, [queryClient, enableNotifications]);

  const handleListingDetected = useCallback((message: ListingDetectedMessage) => {
    // Update listings cache
    queryClient.setQueryData(
      tradingKeys.listings(),
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          listings: [message.data, ...(old.listings || []).slice(0, 49)], // Keep latest 50
        };
      }
    );

    // Show notification for new listings
    if (enableNotifications) {
      toast.success(`New listing detected: ${message.data.symbol}`, {
        description: `Price: $${message.data.price}`,
      });
    }
  }, [queryClient, enableNotifications]);

  const handleSystemAlert = useCallback((message: SystemAlertMessage) => {
    // Show notification for system alerts
    if (enableNotifications) {
      const severity = message.data.severity;
      const toastFn = severity === "critical" || severity === "high" 
        ? toast.error 
        : severity === "medium"
          ? toast.warning
          : toast.info;

      toastFn(message.data.message, {
        description: message.data.component,
      });
    }
  }, [enableNotifications]);

  const handlePerformanceMetric = useCallback((message: PerformanceMetricMessage) => {
    // Could update performance metrics cache or trigger UI updates
    // This is more for real-time monitoring dashboards
    console.log("Performance metric update:", message.data);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status === "connected",
  };
};

// Hook for real-time trading data
export const useRealTimeTrading = (options: RealTimeOptions = {}) => {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  const { status, isConnected } = useWebSocket(wsUrl, options);

  return {
    status,
    isConnected,
    connectionStatus: status,
  };
};

// Hook for real-time bot monitoring
export const useRealTimeBotMonitoring = (options: RealTimeOptions = {}) => {
  const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws"}/bot`;
  const { status, isConnected } = useWebSocket(wsUrl, {
    ...options,
    enableNotifications: true,
  });

  return {
    status,
    isConnected,
    connectionStatus: status,
  };
};

// Hook for real-time system alerts
export const useRealTimeAlerts = (options: RealTimeOptions = {}) => {
  const [alerts, setAlerts] = useState<SystemAlertMessage[]>([]);
  const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws"}/alerts`;
  
  const { status, isConnected } = useWebSocket(wsUrl, {
    ...options,
    enableNotifications: true,
  });

  // Custom message handler for alerts
  const handleAlertMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === "system_alert") {
      setAlerts(prev => [message as SystemAlertMessage, ...prev.slice(0, 99)]); // Keep latest 100
    }
  }, []);

  return {
    alerts,
    status,
    isConnected,
    clearAlerts: () => setAlerts([]),
  };
};

// Hook for real-time performance monitoring
export const useRealTimePerformance = (options: RealTimeOptions = {}) => {
  const [metrics, setMetrics] = useState<PerformanceMetricMessage[]>([]);
  const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws"}/performance`;
  
  const { status, isConnected } = useWebSocket(wsUrl, options);

  // Custom message handler for performance metrics
  const handlePerformanceMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === "performance_metric") {
      setMetrics(prev => [message as PerformanceMetricMessage, ...prev.slice(0, 59)]); // Keep latest 60 (1 hour of data)
    }
  }, []);

  // Calculate average metrics
  const averageMetrics = metrics.length > 0 ? {
    executionTime: metrics.reduce((sum, m) => sum + m.data.executionTime, 0) / metrics.length,
    successRate: metrics.reduce((sum, m) => sum + m.data.successRate, 0) / metrics.length,
    apiResponseTime: metrics.reduce((sum, m) => sum + m.data.apiResponseTime, 0) / metrics.length,
    memoryUsage: metrics.reduce((sum, m) => sum + m.data.memoryUsage, 0) / metrics.length,
    cpuUsage: metrics.reduce((sum, m) => sum + m.data.cpuUsage, 0) / metrics.length,
  } : null;

  return {
    metrics,
    averageMetrics,
    status,
    isConnected,
    clearMetrics: () => setMetrics([]),
  };
};

// Utility hook for connection management
export const useRealTimeConnection = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const queryClient = useQueryClient();

  const enableRealTime = useCallback(() => {
    setIsEnabled(true);
    // Invalidate all queries to force fresh data
    queryClient.invalidateQueries({ queryKey: tradingKeys.all });
  }, [queryClient]);

  const disableRealTime = useCallback(() => {
    setIsEnabled(false);
  }, []);

  return {
    isEnabled,
    enableRealTime,
    disableRealTime,
  };
};

// Hook for real-time data with fallback to polling
export const useRealTimeWithFallback = (
  wsUrl: string,
  pollingQuery: () => Promise<any>,
  queryKey: string[],
  options: RealTimeOptions & { pollingInterval?: number } = {}
) => {
  const { pollingInterval = 5000 } = options;
  const { status, isConnected } = useWebSocket(wsUrl, options);
  const queryClient = useQueryClient();

  // Enable polling when WebSocket is disconnected
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        pollingQuery().then(data => {
          queryClient.setQueryData(queryKey, data);
        }).catch(error => {
          console.error("Polling failed:", error);
        });
      }, pollingInterval);

      return () => clearInterval(interval);
    }
  }, [isConnected, pollingQuery, queryKey, pollingInterval]);

  return {
    status,
    isConnected,
    connectionType: isConnected ? "websocket" : "polling",
  };
};

// Export all real-time hooks
export {
  useWebSocket,
  useRealTimeTrading,
  useRealTimeBotMonitoring,
  useRealTimeAlerts,
  useRealTimePerformance,
  useRealTimeConnection,
  useRealTimeWithFallback,
};

// Export types for external use
export type {
  WebSocketMessage,
  TradeUpdateMessage,
  BotStatusMessage,
  ListingDetectedMessage,
  SystemAlertMessage,
  PerformanceMetricMessage,
  ConnectionStatus,
  RealTimeOptions,
};
