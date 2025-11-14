import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@/lib/api-response";
import { queryKeys } from "@/lib/query-client";

export interface CalendarEntry {
  vcoinId?: string;
  symbol?: string;
  projectName?: string;
  firstOpenTime?: number | string;
  vcoinName?: string;
  vcoinNameFull?: string;
  zone?: string;
}

export interface SymbolEntry {
  cd?: string;
  symbol?: string;
  sts?: number;
  st?: number;
  tt?: number;
  ca?: Record<string, unknown>;
  ps?: Record<string, unknown>;
  qs?: Record<string, unknown>;
  ot?: Record<string, unknown>;
}

// MEXC Calendar Data Hook
export function useMexcCalendar(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.mexcCalendar(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/calendar", {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: ApiResponse<CalendarEntry[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch MEXC calendar");
      }

      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - calendar data cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    enabled,
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}

// MEXC Calendar Refresh Hook
export function useRefreshMexcCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/calendar", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: ApiResponse<CalendarEntry[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch MEXC calendar");
      }

      return result.data || [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.mexcCalendar(), data);
    },
  });
}

// MEXC Symbols Data Hook
export function useMexcSymbols(vcoinId?: string) {
  return useQuery({
    queryKey: queryKeys.mexcSymbols(vcoinId),
    queryFn: async () => {
      const url = vcoinId
        ? `/api/mexc/symbols?vcoinId=${vcoinId}`
        : "/api/mexc/symbols";
      const response = await fetch(url, {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: ApiResponse<SymbolEntry[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch MEXC symbols");
      }

      return result.data || [];
    },
    enabled: true, // Always enabled for symbols data
    staleTime: 30 * 1000, // 30 seconds - symbols data cache
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}

// MEXC Server Time Hook
export function useMexcServerTime() {
  return useQuery({
    queryKey: queryKeys.mexcServerTime(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/server-time", {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.serverTime;
    },
    staleTime: 60 * 1000, // 1 minute - server time cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: Date.now(), // Prevent loading flicker with current time
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}
