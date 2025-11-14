"use client";

import { Clock, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ConfigurationFormData,
  useConfiguration,
} from "@/hooks/use-configuration";

const SELL_STRATEGIES = [
  { value: "PROFIT_TARGET", label: "Profit Target Only" },
  { value: "STOP_LOSS", label: "Stop Loss Only" },
  { value: "TIME_BASED", label: "Time-Based Exit Only" },
  { value: "TRAILING_STOP", label: "Trailing Stop Only" },
  { value: "COMBINED", label: "Combined (All Conditions)" },
] as const satisfies ReadonlyArray<{
  value: NonNullable<ConfigurationFormData["sellStrategy"]>;
  label: string;
}>;

const DEFAULT_STRATEGY: NonNullable<ConfigurationFormData["sellStrategy"]> =
  "COMBINED";

export function SellStrategySettings() {
  const { formData, isLoading, isSubmitting, updateConfiguration } =
    useConfiguration();
  const [localData, setLocalData] = useState<ConfigurationFormData | null>(
    null
  );

  useEffect(() => {
    if (formData) {
      setLocalData(formData);
    }
  }, [formData]);

  if (isLoading || !localData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sell Strategy</CardTitle>
          <CardDescription>
            Configure when to automatically sell positions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    await updateConfiguration(localData);
  };

  // Convert basis points to percentage for display
  const profitTargetPercent = (localData.profitTargetPercent || 500) / 100; // Default 5%
  const stopLossPercent = (localData.stopLossPercent || 200) / 100; // Default 2%
  const trailingStopPercent = localData.trailingStopPercent
    ? localData.trailingStopPercent / 100
    : undefined;
  const timeBasedExitMinutes = localData.timeBasedExitMinutes || 60; // Default 60 minutes

  const hasChanges = JSON.stringify(localData) !== JSON.stringify(formData);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <CardTitle>Sell Strategy</CardTitle>
        </div>
        <CardDescription>
          Configure when to automatically sell positions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sell Strategy Type */}
        <div className="space-y-2">
          <Label htmlFor="sellStrategy">Sell Strategy</Label>
          <Select
            onValueChange={(value) =>
              setLocalData({
                ...localData,
                sellStrategy:
                  value as NonNullable<ConfigurationFormData["sellStrategy"]>,
              })
            }
            value={localData.sellStrategy ?? DEFAULT_STRATEGY}
          >
            <SelectTrigger id="sellStrategy">
              <SelectValue placeholder="Select sell strategy" />
            </SelectTrigger>
            <SelectContent>
              {SELL_STRATEGIES.map((strategy) => (
                <SelectItem key={strategy.value} value={strategy.value}>
                  {strategy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Choose how positions are automatically sold
          </p>
        </div>

        {/* Profit Target */}
        {(localData.sellStrategy === "PROFIT_TARGET" ||
          localData.sellStrategy === "COMBINED") && (
          <div className="space-y-2">
            <Label htmlFor="profitTargetPercent">Profit Target (%)</Label>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <Input
                id="profitTargetPercent"
                max="99.99"
                min="0.01"
                onChange={(e) => {
                  const value = Number.parseFloat(e.target.value) || 0;
                  // Convert percentage to basis points
                  const basisPoints = Math.round(value * 100);
                  setLocalData({
                    ...localData,
                    profitTargetPercent: basisPoints,
                  });
                }}
                step="0.01"
                type="number"
                value={profitTargetPercent.toFixed(2)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Sell when profit reaches this percentage (default: 5%)
            </p>
          </div>
        )}

        {/* Stop Loss */}
        {(localData.sellStrategy === "STOP_LOSS" ||
          localData.sellStrategy === "COMBINED") && (
          <div className="space-y-2">
            <Label htmlFor="stopLossPercent">Stop Loss (%)</Label>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <Input
                id="stopLossPercent"
                max="99.99"
                min="0.01"
                onChange={(e) => {
                  const value = Number.parseFloat(e.target.value) || 0;
                  // Convert percentage to basis points
                  const basisPoints = Math.round(value * 100);
                  setLocalData({
                    ...localData,
                    stopLossPercent: basisPoints,
                  });
                }}
                step="0.01"
                type="number"
                value={stopLossPercent.toFixed(2)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Sell when loss reaches this percentage (default: 2%)
            </p>
          </div>
        )}

        {/* Time-Based Exit */}
        {(localData.sellStrategy === "TIME_BASED" ||
          localData.sellStrategy === "COMBINED") && (
          <div className="space-y-2">
            <Label htmlFor="timeBasedExitMinutes">
              Time-Based Exit (minutes)
            </Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <Input
                id="timeBasedExitMinutes"
                min="1"
                onChange={(e) =>
                  setLocalData({
                    ...localData,
                    timeBasedExitMinutes:
                      Number.parseInt(e.target.value, 10) || 60,
                  })
                }
                type="number"
                value={timeBasedExitMinutes}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Automatically sell after this many minutes (default: 60)
            </p>
          </div>
        )}

        {/* Trailing Stop */}
        {localData.sellStrategy === "TRAILING_STOP" && (
          <div className="space-y-2">
            <Label htmlFor="trailingStopPercent">Trailing Stop (%)</Label>
            <Input
              id="trailingStopPercent"
              max="99.99"
              min="0.01"
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value) || 0;
                // Convert percentage to basis points
                const basisPoints = Math.round(value * 100);
                setLocalData({
                  ...localData,
                  trailingStopPercent: basisPoints,
                });
              }}
              step="0.01"
              type="number"
              value={trailingStopPercent?.toFixed(2) || ""}
            />
            <p className="text-muted-foreground text-xs">
              Sell if price drops by this percentage from peak (optional)
            </p>
          </div>
        )}

        {/* Strategy Preview */}
        <div className="space-y-2 rounded-lg bg-muted p-4">
          <div className="font-medium text-sm">Strategy Preview</div>
          <div className="space-y-1 text-muted-foreground text-sm">
            {localData.sellStrategy === "COMBINED" && (
              <>
                <div>✓ Sell at {profitTargetPercent.toFixed(2)}% profit</div>
                <div>✓ Sell at {stopLossPercent.toFixed(2)}% loss</div>
                <div>✓ Sell after {timeBasedExitMinutes} minutes</div>
              </>
            )}
            {localData.sellStrategy === "PROFIT_TARGET" && (
              <div>✓ Sell at {profitTargetPercent.toFixed(2)}% profit</div>
            )}
            {localData.sellStrategy === "STOP_LOSS" && (
              <div>✓ Sell at {stopLossPercent.toFixed(2)}% loss</div>
            )}
            {localData.sellStrategy === "TIME_BASED" && (
              <div>✓ Sell after {timeBasedExitMinutes} minutes</div>
            )}
            {localData.sellStrategy === "TRAILING_STOP" &&
              trailingStopPercent && (
                <div>
                  ✓ Sell if price drops {trailingStopPercent.toFixed(2)}% from
                  peak
                </div>
              )}
          </div>
        </div>

        {/* Save Button */}
        <Button
          className="w-full"
          disabled={!hasChanges || isSubmitting}
          onClick={handleSave}
        >
          {isSubmitting ? "Saving..." : "Save Sell Strategy"}
        </Button>
      </CardContent>
    </Card>
  );
}
