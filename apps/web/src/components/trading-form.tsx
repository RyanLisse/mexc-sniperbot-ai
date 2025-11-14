"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ConfigurationFormData,
  useConfiguration,
} from "@/hooks/use-configuration";

const DEFAULT_PAIRS = ["BTC/USDT", "ETH/USDT", "BNB/USDT"];

export function TradingForm() {
  const { formData, isLoading, isSubmitting, updateConfiguration } =
    useConfiguration();
  const [localData, setLocalData] = useState<ConfigurationFormData | null>(
    null
  );
  const [pairInput, setPairInput] = useState("");

  useEffect(() => {
    if (formData) {
      setLocalData(formData);
    }
  }, [formData]);

  if (isLoading || !localData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Parameters</CardTitle>
          <CardDescription>
            Configure trading pairs and order parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin opacity-50" />
            <p>Loading configuration...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleAddPair = () => {
    const trimmed = pairInput.trim().toUpperCase();
    if (trimmed && !localData.enabledPairs.includes(trimmed)) {
      setLocalData({
        ...localData,
        enabledPairs: [...localData.enabledPairs, trimmed],
      });
      setPairInput("");
    }
  };

  const handleRemovePair = (pair: string) => {
    setLocalData({
      ...localData,
      enabledPairs: localData.enabledPairs.filter((p) => p !== pair),
    });
  };

  const handleQuickAddPair = (pair: string) => {
    if (!localData.enabledPairs.includes(pair)) {
      setLocalData({
        ...localData,
        enabledPairs: [...localData.enabledPairs, pair],
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateConfiguration(localData);
    } catch (_error) {
      toast.error("Failed to save configuration");
    }
  };

  const hasChanges = JSON.stringify(localData) !== JSON.stringify(formData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Parameters</CardTitle>
        <CardDescription>
          Configure trading pairs and order parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enabled Pairs */}
        <div className="space-y-2">
          <Label>Enabled Trading Pairs</Label>
          <div className="flex gap-2">
            <Input
              onChange={(e) => setPairInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPair();
                }
              }}
              placeholder="e.g., BTC/USDT"
              value={pairInput}
            />
            <Button onClick={handleAddPair} type="button" variant="outline">
              Add
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEFAULT_PAIRS.map((pair) => (
              <Button
                disabled={localData.enabledPairs.includes(pair)}
                key={pair}
                onClick={() => handleQuickAddPair(pair)}
                size="sm"
                type="button"
                variant="outline"
              >
                + {pair}
              </Button>
            ))}
          </div>
          {localData.enabledPairs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {localData.enabledPairs.map((pair) => (
                <div
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                  key={pair}
                >
                  <span>{pair}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemovePair(pair)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Max Purchase Amount */}
        <div className="space-y-2">
          <Label htmlFor="maxPurchaseAmount">Max Purchase Amount (USDT)</Label>
          <Input
            id="maxPurchaseAmount"
            min="1"
            onChange={(e) =>
              setLocalData({
                ...localData,
                maxPurchaseAmount: Number.parseFloat(e.target.value) || 0,
              })
            }
            type="number"
            value={localData.maxPurchaseAmount}
          />
        </div>

        {/* Price Tolerance */}
        <div className="space-y-2">
          <Label htmlFor="priceTolerance">Price Tolerance (%)</Label>
          <Input
            id="priceTolerance"
            max="50"
            min="0.1"
            onChange={(e) =>
              setLocalData({
                ...localData,
                priceTolerance: Number.parseFloat(e.target.value) || 0,
              })
            }
            step="0.1"
            type="number"
            value={localData.priceTolerance}
          />
          <p className="text-muted-foreground text-xs">
            Maximum price deviation tolerance (0.1% - 50%)
          </p>
        </div>

        {/* Polling Interval */}
        <div className="space-y-2">
          <Label htmlFor="pollingInterval">Polling Interval (ms)</Label>
          <Input
            id="pollingInterval"
            min="1000"
            onChange={(e) =>
              setLocalData({
                ...localData,
                pollingInterval: Number.parseInt(e.target.value, 10) || 5000,
              })
            }
            step="1000"
            type="number"
            value={localData.pollingInterval}
          />
          <p className="text-muted-foreground text-xs">
            Minimum: 1000ms (to respect rate limits)
          </p>
        </div>

        {/* Order Timeout */}
        <div className="space-y-2">
          <Label htmlFor="orderTimeout">Order Timeout (ms)</Label>
          <Input
            id="orderTimeout"
            min="5000"
            onChange={(e) =>
              setLocalData({
                ...localData,
                orderTimeout: Number.parseInt(e.target.value, 10) || 10_000,
              })
            }
            step="1000"
            type="number"
            value={localData.orderTimeout}
          />
          <p className="text-muted-foreground text-xs">Minimum: 5000ms</p>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={localData.isActive}
            id="isActive"
            onCheckedChange={(checked) =>
              setLocalData({
                ...localData,
                isActive: checked === true,
              })
            }
          />
          <Label className="cursor-pointer" htmlFor="isActive">
            Enable automated trading
          </Label>
        </div>

        {/* Save Button */}
        <Button
          className="w-full"
          disabled={!hasChanges || isSubmitting}
          onClick={handleSave}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
