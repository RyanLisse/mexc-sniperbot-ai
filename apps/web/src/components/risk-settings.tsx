"use client";

import { AlertCircle, Shield, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  type ConfigurationFormData,
  useConfiguration,
} from "@/hooks/use-configuration";

export function RiskSettings() {
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
          <CardTitle>Risk Management</CardTitle>
          <CardDescription>
            Configure risk limits and safety parameters
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

  const hasRiskIssues =
    localData.maxPurchaseAmount > localData.dailySpendingLimit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Risk Management</CardTitle>
        </div>
        <CardDescription>
          Configure risk limits and safety parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasRiskIssues && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Max purchase amount cannot exceed daily spending limit
            </AlertDescription>
          </Alert>
        )}

        {/* Daily Spending Limit */}
        <div className="space-y-2">
          <Label htmlFor="dailySpendingLimit">
            Daily Spending Limit (USDT)
          </Label>
          <Input
            id="dailySpendingLimit"
            min="1"
            onChange={(e) =>
              setLocalData({
                ...localData,
                dailySpendingLimit: Number.parseFloat(e.target.value) || 0,
              })
            }
            type="number"
            value={localData.dailySpendingLimit}
          />
          <p className="text-muted-foreground text-xs">
            Maximum total trading volume per day
          </p>
        </div>

        {/* Max Purchase Amount */}
        <div className="space-y-2">
          <Label htmlFor="maxPurchaseAmount">Max Purchase Amount (USDT)</Label>
          <Input
            id="maxPurchaseAmount"
            max={localData.dailySpendingLimit}
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
          <p className="text-muted-foreground text-xs">
            Maximum amount per single trade (must be ≤ daily limit)
          </p>
        </div>

        {/* Max Trades Per Hour */}
        <div className="space-y-2">
          <Label htmlFor="maxTradesPerHour">Max Trades Per Hour</Label>
          <Input
            id="maxTradesPerHour"
            min="1"
            onChange={(e) =>
              setLocalData({
                ...localData,
                maxTradesPerHour: Number.parseInt(e.target.value, 10) || 1,
              })
            }
            type="number"
            value={localData.maxTradesPerHour}
          />
          <p className="text-muted-foreground text-xs">
            Rate limiting to prevent excessive trading
          </p>
        </div>

        {/* Risk Summary */}
        <div className="space-y-2 rounded-lg bg-muted p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Risk Summary</span>
          </div>
          <div className="space-y-1 text-muted-foreground text-sm">
            <div>
              Max per trade: ${localData.maxPurchaseAmount.toFixed(2)} USDT
            </div>
            <div>
              Daily limit: ${localData.dailySpendingLimit.toFixed(2)} USDT
            </div>
            <div>Max trades/hour: {localData.maxTradesPerHour}</div>
            <div>
              Theoretical max/hour: $
              {(
                localData.maxPurchaseAmount * localData.maxTradesPerHour
              ).toFixed(2)}{" "}
              USDT
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          className="w-full"
          disabled={hasRiskIssues || isSubmitting}
          onClick={handleSave}
        >
          Save Risk Settings
        </Button>
      </CardContent>
    </Card>
  );
}
