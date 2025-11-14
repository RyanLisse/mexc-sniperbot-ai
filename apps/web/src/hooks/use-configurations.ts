"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Configuration type matching backend schema
 */
export type Configuration = {
  id: string;
  name: string;
  symbols: string[];
  quoteAmount: number;
  maxTradesPerHour: number;
  maxDailySpend: number;
  recvWindow: number;
  safetyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

/**
 * Create configuration request
 */
export type CreateConfigurationRequest = Omit<
  Configuration,
  "id" | "createdAt" | "updatedAt" | "createdBy"
>;

/**
 * List configurations response
 */
type ListConfigurationsResponse = {
  configurations: Configuration[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/**
 * Encore API base URL
 */
const getApiUrl = () =>
  process.env.NEXT_PUBLIC_ENCORE_API_URL || "http://localhost:4000";

/**
 * Fetch all configurations from Encore API
 */
async function fetchConfigurations(
  limit = 20,
  offset = 0
): Promise<ListConfigurationsResponse> {
  const url = new URL(`${getApiUrl()}/configurations`);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch configurations");
  }

  return response.json();
}

/**
 * Fetch single configuration by ID
 */
async function fetchConfiguration(id: string): Promise<Configuration> {
  const response = await fetch(`${getApiUrl()}/configurations/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Configuration not found");
  }

  return response.json();
}

/**
 * Create new configuration via Encore API
 */
async function createConfiguration(
  data: CreateConfigurationRequest
): Promise<Configuration> {
  const response = await fetch(`${getApiUrl()}/configurations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error ||
        error.details?.[0]?.message ||
        "Failed to create configuration"
    );
  }

  return response.json();
}

/**
 * Delete configuration by ID
 */
async function deleteConfiguration(id: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/configurations/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to delete configuration");
  }
}

/**
 * React Query hook to fetch configurations with pagination
 */
export function useConfigurations(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["configurations", { limit, offset }],
    queryFn: () => fetchConfigurations(limit, offset),
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to fetch single configuration
 */
export function useConfiguration(id: string | undefined) {
  return useQuery({
    queryKey: ["configuration", id],
    queryFn: () => {
      if (!id) throw new Error("Configuration ID is required");
      return fetchConfiguration(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * React Query mutation to create configuration with optimistic updates
 */
export function useCreateConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConfiguration,
    onSuccess: (newConfig) => {
      // Invalidate configurations list to refetch
      queryClient.invalidateQueries({ queryKey: ["configurations"] });

      // Optimistically add to cache
      queryClient.setQueryData<ListConfigurationsResponse>(
        ["configurations", { limit: 20, offset: 0 }],
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            configurations: [newConfig, ...old.configurations],
            total: old.total + 1,
          };
        }
      );

      toast.success("Configuration created successfully", {
        description: `"${newConfig.name}" is ready to use`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to create configuration", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation to delete configuration
 */
export function useDeleteConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConfiguration,
    onSuccess: (_, deletedId) => {
      // Invalidate and refetch configurations
      queryClient.invalidateQueries({ queryKey: ["configurations"] });

      // Remove from cache
      queryClient.setQueryData<ListConfigurationsResponse>(
        ["configurations", { limit: 20, offset: 0 }],
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            configurations: old.configurations.filter(
              (config) => config.id !== deletedId
            ),
            total: old.total - 1,
          };
        }
      );

      toast.success("Configuration deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete configuration", {
        description: error.message,
      });
    },
  });
}
