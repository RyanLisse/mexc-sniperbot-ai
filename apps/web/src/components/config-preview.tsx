"use client";

import {
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfiguration } from "@/hooks/use-configuration";

export function ConfigPreview() {
  const { formData, isLoading } = useConfiguration();

  if (isLoading || !formData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration Preview</CardTitle>
          <CardDescription>
            Current trading configuration summary
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Preview</CardTitle>
        <CardDescription>Current trading configuration summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">Trading Status</span>
          <Badge variant={formData.isActive ? "default" : "secondary"}>
            {formData.isActive ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Inactive
              </>
            )}
          </Badge>
        </div>

        {/* Enabled Pairs */}
        <div className="space-y-2">
          <span className="font-medium text-sm">Enabled Pairs</span>
          <div className="flex flex-wrap gap-2">
            {formData.enabledPairs.length > 0 ? (
              formData.enabledPairs.map((pair) => (
                <Badge key={pair} variant="outline">
                  {pair}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">
                No pairs enabled
              </span>
            )}
          </div>
        </div>

        {/* Trading Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Max Purchase</span>
            </div>
            <div className="font-semibold text-lg">
              ${formData.maxPurchaseAmount.toFixed(2)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Price Tolerance</span>
            </div>
            <div className="font-semibold text-lg">
              {formData.priceTolerance.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Polling Interval</span>
            </div>
            <div className="font-semibold text-lg">
              {(formData.pollingInterval / 1000).toFixed(1)}s
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Order Timeout</span>
            </div>
            <div className="font-semibold text-lg">
              {(formData.orderTimeout / 1000).toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Risk Limits */}
        <div className="space-y-2 border-t pt-4">
          <span className="font-medium text-sm">Risk Limits</span>
          <div className="space-y-1 text-muted-foreground text-sm">
            <div>
              Daily Limit: ${formData.dailySpendingLimit.toFixed(2)} USDT
            </div>
            <div>Max Trades/Hour: {formData.maxTradesPerHour}</div>
          </div>
        </div>

        {/* Sell Strategy */}
        {formData.sellStrategy && (
          <div className="space-y-2 border-t pt-4">
            <span className="font-medium text-sm">Sell Strategy</span>
            <div className="space-y-1 text-muted-foreground text-sm">
              <div>
                Strategy:{" "}
                {formData.sellStrategy === "COMBINED"
                  ? "Combined"
                  : formData.sellStrategy === "PROFIT_TARGET"
                    ? "Profit Target"
                    : formData.sellStrategy === "STOP_LOSS"
                      ? "Stop Loss"
                      : formData.sellStrategy === "TIME_BASED"
                        ? "Time-Based"
                        : "Trailing Stop"}
              </div>
              {formData.profitTargetPercent && (
                <div>
                  Profit Target:{" "}
                  {(formData.profitTargetPercent / 100).toFixed(2)}%
                </div>
              )}
              {formData.stopLossPercent && (
                <div>
                  Stop Loss: {(formData.stopLossPercent / 100).toFixed(2)}%
                </div>
              )}
              {formData.timeBasedExitMinutes && (
                <div>Time Exit: {formData.timeBasedExitMinutes} minutes</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
