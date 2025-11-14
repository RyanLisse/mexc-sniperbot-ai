"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Bot status type
 */
export type BotStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed";

/**
 * Bot run metrics
 */
export type BotMetrics = {
  tradesThisHour: number;
  spentToday: number;
  queueDepth: number;
  avgLatencyMs: number;
  successRate: number;
};

/**
 * Bot status response
 */
export type BotStatusResponse = {
  status: BotStatus;
  runId?: string;
  configurationId?: string;
  configurationName?: string;
  startedAt?: string;
  lastHeartbeat?: string;
  errorMessage?: string;
  metrics?: BotMetrics;
};

/**
 * Start bot request
 */
export type StartBotRequest = {
  configurationId: string;
};

/**
 * Encore API base URL
 */
const getApiUrl = () =>
  process.env.NEXT_PUBLIC_ENCORE_API_URL || "http://localhost:4000";

/**
 * Fetch current bot status from Encore API
 */
async function fetchBotStatus(): Promise<BotStatusResponse> {
  const response = await fetch(`${getApiUrl()}/bot/status`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch bot status");
  }

  return response.json();
}

/**
 * Start bot with configuration
 */
async function startBot(request: StartBotRequest): Promise<BotStatusResponse> {
  const response = await fetch(`${getApiUrl()}/bot/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to start bot");
  }

  return response.json();
}

/**
 * Stop bot gracefully
 */
async function stopBot(): Promise<BotStatusResponse> {
  const response = await fetch(`${getApiUrl()}/bot/stop`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to stop bot");
  }

  return response.json();
}

/**
 * React Query hook to fetch bot status with polling every 5 seconds
 */
export function useBotStatus() {
  return useQuery({
    queryKey: ["bot-status"],
    queryFn: fetchBotStatus,
    refetchInterval: 5000, // Poll every 5 seconds
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh polling
  });
}

/**
 * React Query mutation to start bot
 */
export function useStartBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startBot,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid optimistic update overwrite
      await queryClient.cancelQueries({ queryKey: ["bot-status"] });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData<BotStatusResponse>([
        "bot-status",
      ]);

      // Optimistically update to starting state
      queryClient.setQueryData<BotStatusResponse>(["bot-status"], {
        status: "starting",
        configurationId: variables.configurationId,
        metrics: previousStatus?.metrics,
      });

      return { previousStatus };
    },
    onSuccess: (data) => {
      // Update with actual response
      queryClient.setQueryData<BotStatusResponse>(["bot-status"], data);

      toast.success("Bot started successfully", {
        description: `Running with configuration: ${data.configurationName || data.configurationId}`,
      });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous status on error
      if (context?.previousStatus) {
        queryClient.setQueryData<BotStatusResponse>(
          ["bot-status"],
          context.previousStatus
        );
      }

      toast.error("Failed to start bot", {
        description: error.message,
      });
    },
    onSettled: () => {
      // Ensure refetch after mutation completes
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
    },
  });
}

/**
 * React Query mutation to stop bot
 */
export function useStopBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopBot,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["bot-status"] });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData<BotStatusResponse>([
        "bot-status",
      ]);

      // Optimistically update to stopping state
      queryClient.setQueryData<BotStatusResponse>(["bot-status"], (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          status: "stopping",
        };
      });

      return { previousStatus };
    },
    onSuccess: (data) => {
      // Update with actual response
      queryClient.setQueryData<BotStatusResponse>(["bot-status"], data);

      toast.success("Bot stopped successfully", {
        description: "All active operations have been terminated",
      });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous status on error
      if (context?.previousStatus) {
        queryClient.setQueryData<BotStatusResponse>(
          ["bot-status"],
          context.previousStatus
        );
      }

      toast.error("Failed to stop bot", {
        description: error.message,
      });
    },
    onSettled: () => {
      // Ensure refetch after mutation completes
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
    },
  });
}

/**
 * Check if bot is currently active (running or starting)
 */
export function isBotActive(status?: BotStatus): boolean {
  return status === "running" || status === "starting";
}

/**
 * Check if bot can be started
 */
export function canStartBot(status?: BotStatus): boolean {
  return status === "stopped" || status === "failed" || !status;
}

/**
 * Check if bot can be stopped
 */
export function canStopBot(status?: BotStatus): boolean {
  return status === "running" || status === "starting";
}
