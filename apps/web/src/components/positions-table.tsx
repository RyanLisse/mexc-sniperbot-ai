"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/utils/trpc";

type Position = {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryTime: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  buyOrderId: string;
};

export function PositionsTable() {
  const {
    data: positionsData,
    isLoading,
    refetch,
  } = useQuery(trpc.trading.getOpenPositions.queryOptions());

  const executeSellMutation = useMutation(
    trpc.trading.executeManualSell.mutationOptions({
      onSuccess: () => {
        toast.success("Sell order executed successfully");
        void refetch();
      },
      onError: (error) => {
        toast.error(`Failed to execute sell: ${error.message}`);
      },
    })
  );

  const handleManualSell = async (symbol: string, quantity: number) => {
    if (
      !confirm(
        `Are you sure you want to sell ${quantity} of ${symbol}? This action cannot be undone.`
      )
    ) {
      return;
    }

    await executeSellMutation.mutateAsync({
      symbol,
      quantity: quantity.toString(),
      strategy: "MARKET",
    });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(price);

  const formatTimeAgo = (entryTime: string) => {
    const entry = new Date(entryTime);
    const now = new Date();
    const diffMs = now.getTime() - entry.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h ago`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m ago`;
    }
    return `${diffMins}m ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Currently held positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Loading positions...
          </div>
        </CardContent>
      </Card>
    );
  }

  const positions = positionsData?.positions || [];
  const totalUnrealizedPnL = positions.reduce(
    (sum, pos) => sum + pos.unrealizedPnL,
    0
  );

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Currently held positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <TrendingUp className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>No open positions</p>
            <p className="mt-1 text-xs">
              Positions will appear here after successful buy orders
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>
              {positions.length} active position
              {positions.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-sm">
              Total Unrealized PnL
            </div>
            <div
              className={`font-semibold text-lg ${
                totalUnrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalUnrealizedPnL >= 0 ? (
                <ArrowUp className="mr-1 inline h-4 w-4" />
              ) : (
                <ArrowDown className="mr-1 inline h-4 w-4" />
              )}
              {formatPrice(totalUnrealizedPnL)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Unrealized PnL</TableHead>
              <TableHead>PnL %</TableHead>
              <TableHead>Held For</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position: Position) => (
              <TableRow key={position.symbol}>
                <TableCell className="font-medium">{position.symbol}</TableCell>
                <TableCell>{position.quantity.toFixed(8)}</TableCell>
                <TableCell>{formatPrice(position.entryPrice)}</TableCell>
                <TableCell>{formatPrice(position.currentPrice)}</TableCell>
                <TableCell>
                  <div
                    className={`flex items-center gap-1 ${
                      position.unrealizedPnL >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {position.unrealizedPnL >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPrice(position.unrealizedPnL)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      position.unrealizedPnLPercent >= 0
                        ? "default"
                        : "destructive"
                    }
                  >
                    {position.unrealizedPnLPercent >= 0 ? "+" : ""}
                    {position.unrealizedPnLPercent.toFixed(2)}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(position.entryTime)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    disabled={executeSellMutation.isPending}
                    onClick={() =>
                      handleManualSell(position.symbol, position.quantity)
                    }
                    size="sm"
                    variant="outline"
                  >
                    {executeSellMutation.isPending ? (
                      "Selling..."
                    ) : (
                      <>
                        <DollarSign className="mr-1 h-3 w-3" />
                        Sell
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
