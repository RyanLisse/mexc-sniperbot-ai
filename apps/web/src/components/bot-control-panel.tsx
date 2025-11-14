"use client";

import { AlertCircle, Loader2, Play, Square } from "lucide-react";
import { useState } from "react";
import { BotStatusExtended } from "@/components/bot-status-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canStartBot,
  canStopBot,
  useBotStatus,
  useStartBot,
  useStopBot,
} from "@/hooks/use-bot-control";
import { useConfigurations } from "@/hooks/use-configurations";

type BotControlPanelProps = {
  className?: string;
};

/**
 * Bot control panel with configuration selector and start/stop buttons
 * Polls bot status every 5 seconds and shows real-time metrics
 *
 * @example
 * ```tsx
 * <BotControlPanel />
 * ```
 */
export function BotControlPanel({ className }: BotControlPanelProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  // Fetch bot status with polling
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useBotStatus();

  // Fetch configurations
  const { data: configurationsData, isLoading: configurationsLoading } =
    useConfigurations(20, 0);

  // Bot control mutations
  const startBot = useStartBot();
  const stopBot = useStopBot();

  const configurations = configurationsData?.configurations || [];
  const botStatus = status?.status;
  const isActive = botStatus === "running" || botStatus === "starting";

  const handleStart = () => {
    if (!selectedConfigId) {
      return;
    }
    startBot.mutate({ configurationId: selectedConfigId });
  };

  const handleStop = () => {
    stopBot.mutate();
  };

  // Auto-select current configuration if bot is running
  if (status?.configurationId && !selectedConfigId) {
    setSelectedConfigId(status.configurationId);
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Bot Control</CardTitle>
        <CardDescription>
          Start or stop the trading bot with selected configuration
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Display */}
        {status && (
          <BotStatusExtended
            errorMessage={status.errorMessage}
            lastHeartbeat={status.lastHeartbeat}
            startedAt={status.startedAt}
            status={status.status}
          />
        )}

        {statusError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load bot status. Please check your connection.
            </AlertDescription>
          </Alert>
        )}

        {/* Configuration Selector */}
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="configuration">
            Configuration
          </label>
          <Select
            disabled={isActive || configurationsLoading}
            onValueChange={setSelectedConfigId}
            value={selectedConfigId}
          >
            <SelectTrigger id="configuration">
              <SelectValue placeholder="Select a configuration" />
            </SelectTrigger>
            <SelectContent>
              {configurations.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                  <span className="ml-2 text-gray-500 text-xs">
                    ({config.symbols.length} symbols, ${config.quoteAmount})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {configurations.length === 0 && !configurationsLoading && (
            <p className="text-gray-500 text-sm">
              No configurations available. Create one to get started.
            </p>
          )}
        </div>

        {/* Metrics Display */}
        {status?.metrics && isActive && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
            <div>
              <p className="text-gray-500 text-sm">Trades/Hour</p>
              <p className="font-bold text-2xl">
                {status.metrics.tradesThisHour}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Spent Today</p>
              <p className="font-bold text-2xl">
                ${status.metrics.spentToday.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Queue Depth</p>
              <p className="font-bold text-2xl">{status.metrics.queueDepth}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Avg Latency</p>
              <p className="font-bold text-2xl">
                {status.metrics.avgLatencyMs}ms
              </p>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            disabled={
              !(canStartBot(botStatus) && selectedConfigId) ||
              startBot.isPending ||
              statusLoading
            }
            onClick={handleStart}
            size="lg"
          >
            {startBot.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Bot
              </>
            )}
          </Button>

          <Button
            className="flex-1"
            disabled={
              !canStopBot(botStatus) || stopBot.isPending || statusLoading
            }
            onClick={handleStop}
            size="lg"
            variant="destructive"
          >
            {stopBot.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Bot
              </>
            )}
          </Button>
        </div>

        {/* Configuration Info */}
        {status?.configurationName && isActive && (
          <div className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
            <p className="font-medium text-sm">Active Configuration</p>
            <p className="text-lg">{status.configurationName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
