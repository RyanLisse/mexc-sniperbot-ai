import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Types for API responses
interface TradingStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  averageExecutionTime: number;
  totalVolume: number;
  totalValue: number;
  averageTradeValue: number;
}

interface TradeHistoryItem {
  id: string;
  symbol: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  strategy: "MARKET" | "LIMIT";
  quantity: string;
  targetPrice?: string;
  executedPrice?: string;
  executedQuantity?: string;
  createdAt: string;
  completedAt?: string;
  executionTime: number;
  error?: string;
  value: number;
}

interface ListingEvent {
  id: string;
  symbol: string;
  eventType: string;
  price: string;
  detectedAt: string;
  metadata: {
    detectionMethod?: string;
    volume?: string;
    change24h?: string;
  };
}

interface BotStatus {
  isRunning: boolean;
  lastHeartbeat: string;
  mexcApiStatus: string;
  apiResponseTime: number;
  uptime: number;
  version: string;
  startTime: string;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  components: Record<string, {
    status: "operational" | "degraded" | "down";
    message?: string;
    responseTime?: number;
    lastChecked: string;
  }>;
  issues: Array<{
    type: "performance" | "connectivity" | "resource";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }>;
  uptime: number;
}

interface ManualTradeRequest {
  symbol: string;
  strategy: "MARKET" | "LIMIT";
}

interface ManualTradeResponse {
  success: boolean;
  message: string;
  symbol: string;
  strategy: string;
  timestamp: string;
}

interface BotControlRequest {
  action: "start" | "stop" | "restart" | "status";
}

interface BotControlResponse {
  success: boolean;
  action: string;
  result: any;
  timestamp: string;
}

// API base URL
const API_BASE = "/api/trading";

// React Query keys
export const tradingKeys = {
  all: ["trading"] as const,
  stats: () => [...tradingKeys.all, "stats"] as const,
  history: (filters?: any) => [...tradingKeys.all, "history", filters] as const,
  listings: (filters?: any) => [...tradingKeys.all, "listings", filters] as const,
  botStatus: () => [...tradingKeys.all, "botStatus"] as const,
  systemHealth: () => [...tradingKeys.all, "systemHealth"] as const,
};

// Generic fetch function
const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
};

// Hooks for trading statistics
export const useTradingStats = () => {
  return useQuery({
    queryKey: tradingKeys.stats(),
    queryFn: () => apiFetch<TradingStats>(`${API_BASE}/stats`),
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 2000,
  });
};

// Hooks for trade history
export const useTradeHistory = (filters?: {
  limit?: number;
  symbol?: string;
  status?: "SUCCESS" | "FAILED" | "PENDING";
}) => {
  const params = new URLSearchParams();
  if (filters?.limit) params.append("limit", filters.limit.toString());
  if (filters?.symbol) params.append("symbol", filters.symbol);
  if (filters?.status) params.append("status", filters.status);

  return useQuery({
    queryKey: tradingKeys.history(filters),
    queryFn: () => apiFetch<{ trades: TradeHistoryItem[]; total: number }>(
      `${API_BASE}/history?${params.toString()}`
    ),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
};

// Hooks for recent listings
export const useRecentListings = (filters?: {
  hours?: number;
  symbol?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.hours) params.append("hours", filters.hours.toString());
  if (filters?.symbol) params.append("symbol", filters.symbol);

  return useQuery({
    queryKey: tradingKeys.listings(filters),
    queryFn: () => apiFetch<{ 
      listings: ListingEvent[]; 
      total: number;
      timeRange: string;
    }>(`${API_BASE}/recent-listings?${params.toString()}`),
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000,
  });
};

// Hooks for bot status
export const useBotStatus = () => {
  return useQuery({
    queryKey: tradingKeys.botStatus(),
    queryFn: () => apiFetch<BotStatus>(`${API_BASE}/bot-status`),
    refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
    staleTime: 1000,
  });
};

// Hooks for system health
export const useSystemHealth = () => {
  return useQuery({
    queryKey: tradingKeys.systemHealth(),
    queryFn: () => apiFetch<SystemHealth>("/api/monitoring/system-status"),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
};

// Mutation for manual trade execution
export const useManualTrade = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ManualTradeRequest) =>
      apiFetch<ManualTradeResponse>(`${API_BASE}/execute-manual-trade`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: tradingKeys.history() });
      queryClient.invalidateQueries({ queryKey: tradingKeys.stats() });
    },
    onError: (error: Error) => {
      toast.error(`Trade execution failed: ${error.message}`);
    },
  });
};

// Mutation for bot control
export const useBotControl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BotControlRequest) =>
      apiFetch<BotControlResponse>(`${API_BASE}/control-bot`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast.success(data.result.message || `Bot ${data.action} successful`);
      // Invalidate bot status query
      queryClient.invalidateQueries({ queryKey: tradingKeys.botStatus() });
    },
    onError: (error: Error) => {
      toast.error(`Bot control failed: ${error.message}`);
    },
  });
};

// Mutation for order cancellation
export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { orderId: string; symbol: string }) =>
      apiFetch(`${API_BASE}/cancel-order`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: tradingKeys.history() });
    },
    onError: (error: Error) => {
      toast.error(`Order cancellation failed: ${error.message}`);
    },
  });
};

// Hook for real-time trading data (combines multiple queries)
export const useRealTimeTradingData = () => {
  const stats = useTradingStats();
  const history = useTradeHistory({ limit: 10 });
  const botStatus = useBotStatus();
  const systemHealth = useSystemHealth();

  return {
    stats: stats.data,
    history: history.data?.trades || [],
    botStatus: botStatus.data,
    systemHealth: systemHealth.data,
    isLoading: stats.isLoading || history.isLoading || botStatus.isLoading || systemHealth.isLoading,
    error: stats.error || history.error || botStatus.error || systemHealth.error,
    refetch: () => {
      stats.refetch();
      history.refetch();
      botStatus.refetch();
      systemHealth.refetch();
    },
  };
};

// Hook for trading metrics (aggregated data)
export const useTradingMetrics = (timeRange: "1h" | "6h" | "24h" | "7d" = "24h") => {
  return useQuery({
    queryKey: [...tradingKeys.all, "metrics", timeRange],
    queryFn: () => apiFetch(`/api/monitoring/performance-metrics?timeRange=${timeRange}`),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
  });
};

// Hook for detector statistics
export const useDetectorStats = () => {
  return useQuery({
    queryKey: [...tradingKeys.all, "detectorStats"],
    queryFn: () => apiFetch(`${API_BASE}/detector-stats`),
    refetchInterval: 20000, // Refetch every 20 seconds
    staleTime: 10000,
  });
};

// Utility functions for formatting data
export const formatTradeValue = (trade: TradeHistoryItem): string => {
  if (trade.status !== "SUCCESS") return "Failed";
  return `$${trade.value.toFixed(2)}`;
};

export const formatExecutionTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const getTradeStatusColor = (status: string): "default" | "destructive" | "secondary" => {
  switch (status) {
    case "SUCCESS":
      return "default";
    case "FAILED":
      return "destructive";
    case "PENDING":
      return "secondary";
    default:
      return "outline";
  }
};

// Custom hook for polling with interval control
export const useTradingPolling = (
  queryFn: () => Promise<any>,
  queryKey: string[],
  options?: {
    interval?: number;
    enabled?: boolean;
  }
) => {
  const { interval = 5000, enabled = true } = options || {};

  return useQuery({
    queryKey,
    queryFn,
    refetchInterval: enabled ? interval : false,
    enabled,
    staleTime: interval / 2,
  });
};
