"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export type SellStrategy =
  | "PROFIT_TARGET"
  | "STOP_LOSS"
  | "TIME_BASED"
  | "TRAILING_STOP"
  | "COMBINED";

const SELL_STRATEGY_VALUES: ReadonlySet<SellStrategy> = new Set([
  "PROFIT_TARGET",
  "STOP_LOSS",
  "TIME_BASED",
  "TRAILING_STOP",
  "COMBINED",
]);

const normalizeSellStrategy = (
  value: unknown
): SellStrategy | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  return SELL_STRATEGY_VALUES.has(value as SellStrategy)
    ? (value as SellStrategy)
    : undefined;
};

type ApiTradingConfiguration = {
  id: string;
  enabledPairs: string[] | null;
  maxPurchaseAmount: number;
  priceTolerance: number;
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval: number;
  orderTimeout: number;
  profitTargetPercent?: number | null;
  stopLossPercent?: number | null;
  timeBasedExitMinutes?: number | null;
  trailingStopPercent?: number | null;
  sellStrategy?: SellStrategy | null;
  isActive: boolean;
};

const DEFAULT_CONFIGURATION: ConfigurationFormData = {
  enabledPairs: ["BTCUSDT", "ETHUSDT"],
  maxPurchaseAmount: 100,
  priceTolerance: 1,
  dailySpendingLimit: 1000,
  maxTradesPerHour: 10,
  pollingInterval: 5000,
  orderTimeout: 10_000,
  profitTargetPercent: 500,
  stopLossPercent: 200,
  timeBasedExitMinutes: 60,
  trailingStopPercent: undefined,
  sellStrategy: "COMBINED",
  isActive: false,
};

export type ConfigurationFormData = {
  enabledPairs: string[];
  maxPurchaseAmount: number;
  priceTolerance: number;
  dailySpendingLimit: number;
  maxTradesPerHour: number;
  pollingInterval: number;
  orderTimeout: number;
  profitTargetPercent?: number; // basis points (500 = 5%)
  stopLossPercent?: number; // basis points (200 = 2%)
  timeBasedExitMinutes?: number; // minutes
  trailingStopPercent?: number; // basis points (optional)
  sellStrategy?: SellStrategy;
  isActive: boolean;
};

const convertConfigToFormData = (
  config: ApiTradingConfiguration
): ConfigurationFormData => {
  return {
    enabledPairs: Array.isArray(config.enabledPairs) ? config.enabledPairs : [],
    maxPurchaseAmount: config.maxPurchaseAmount,
    priceTolerance: config.priceTolerance / 100, // Convert from basis points to percentage
    dailySpendingLimit: config.dailySpendingLimit,
    maxTradesPerHour: config.maxTradesPerHour,
    pollingInterval: config.pollingInterval,
    orderTimeout: config.orderTimeout,
    profitTargetPercent: config.profitTargetPercent ?? undefined,
    stopLossPercent: config.stopLossPercent ?? undefined,
    timeBasedExitMinutes: config.timeBasedExitMinutes ?? undefined,
    trailingStopPercent: config.trailingStopPercent ?? undefined,
  sellStrategy: normalizeSellStrategy(config.sellStrategy),
    isActive: config.isActive,
  };
};

export function useConfiguration() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: configurations,
    isLoading,
    refetch,
  } = useQuery(
    trpc.configuration.getConfigurations.queryOptions({
      isActive: true,
      limit: 1,
    })
  );

  const activeConfig = configurations?.[0];
  const formData = activeConfig
    ? convertConfigToFormData(activeConfig as ApiTradingConfiguration)
    : null;

  const updateMutation = useMutation(
    trpc.configuration.updateConfiguration.mutationOptions({
      onSuccess: () => {
        toast.success("Configuration updated successfully");
        void refetch();
      },
      onError: (error) => {
        toast.error(`Failed to update configuration: ${error.message}`);
      },
    })
  );

  const updateConfiguration = useCallback(
    async (updates: Partial<ConfigurationFormData>) => {
      if (!activeConfig) {
        toast.error("No active configuration found");
        return;
      }

      setIsSubmitting(true);
      try {
        const updateData: Record<string, unknown> = {};

        if (updates.enabledPairs !== undefined) {
          updateData.enabledPairs = updates.enabledPairs;
        }
        if (updates.maxPurchaseAmount !== undefined) {
          updateData.maxPurchaseAmount = updates.maxPurchaseAmount;
        }
        if (updates.priceTolerance !== undefined) {
          updateData.priceTolerance = updates.priceTolerance;
        }
        if (updates.dailySpendingLimit !== undefined) {
          updateData.dailySpendingLimit = updates.dailySpendingLimit;
        }
        if (updates.maxTradesPerHour !== undefined) {
          updateData.maxTradesPerHour = updates.maxTradesPerHour;
        }
        if (updates.pollingInterval !== undefined) {
          updateData.pollingInterval = updates.pollingInterval;
        }
        if (updates.orderTimeout !== undefined) {
          updateData.orderTimeout = updates.orderTimeout;
        }
        if (updates.isActive !== undefined) {
          updateData.isActive = updates.isActive;
        }
        if (updates.profitTargetPercent !== undefined) {
          updateData.profitTargetPercent = updates.profitTargetPercent;
        }
        if (updates.stopLossPercent !== undefined) {
          updateData.stopLossPercent = updates.stopLossPercent;
        }
        if (updates.timeBasedExitMinutes !== undefined) {
          updateData.timeBasedExitMinutes = updates.timeBasedExitMinutes;
        }
        if (updates.trailingStopPercent !== undefined) {
          updateData.trailingStopPercent = updates.trailingStopPercent;
        }
        if (updates.sellStrategy !== undefined) {
          updateData.sellStrategy = updates.sellStrategy;
        }

        await updateMutation.mutateAsync({
          id: activeConfig.id,
          ...updateData,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeConfig, updateMutation]
  );

  const resetConfiguration = useCallback(async () => {
    if (!activeConfig) {
      toast.error("No configuration available to reset");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: activeConfig.id,
        enabledPairs: DEFAULT_CONFIGURATION.enabledPairs,
        maxPurchaseAmount: DEFAULT_CONFIGURATION.maxPurchaseAmount,
        priceTolerance: DEFAULT_CONFIGURATION.priceTolerance,
        dailySpendingLimit: DEFAULT_CONFIGURATION.dailySpendingLimit,
        maxTradesPerHour: DEFAULT_CONFIGURATION.maxTradesPerHour,
        pollingInterval: DEFAULT_CONFIGURATION.pollingInterval,
        orderTimeout: DEFAULT_CONFIGURATION.orderTimeout,
        isActive: DEFAULT_CONFIGURATION.isActive,
        profitTargetPercent: DEFAULT_CONFIGURATION.profitTargetPercent,
        stopLossPercent: DEFAULT_CONFIGURATION.stopLossPercent,
        timeBasedExitMinutes: DEFAULT_CONFIGURATION.timeBasedExitMinutes,
        trailingStopPercent: DEFAULT_CONFIGURATION.trailingStopPercent,
        sellStrategy: DEFAULT_CONFIGURATION.sellStrategy,
      });
      toast.success("Configuration reset to defaults");
      void refetch();
    } finally {
      setIsSubmitting(false);
    }
  }, [activeConfig, refetch, updateMutation]);

  return {
    activeConfig,
    formData,
    isLoading,
    isSubmitting,
    updateConfiguration,
    resetConfiguration,
    refetch,
  };
}
