"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  TrendingUp, 
  Clock, 
  Zap, 
  Play,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

// Mock data - will be replaced with real API calls
const mockTradeHistory = [
  {
    id: "trade_001",
    symbol: "BTCUSDT",
    status: "SUCCESS",
    strategy: "MARKET",
    quantity: "0.001",
    executedPrice: "43250.50",
    executedQuantity: "0.001",
    createdAt: new Date(Date.now() - 2 * 60 * 1000),
    executionTime: 234,
    value: 43.25
  },
  {
    id: "trade_002",
    symbol: "ETHUSDT",
    status: "SUCCESS",
    strategy: "LIMIT",
    quantity: "0.01",
    executedPrice: "2240.75",
    executedQuantity: "0.01",
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    executionTime: 187,
    value: 22.41
  },
  {
    id: "trade_003",
    symbol: "ADAUSDT",
    status: "FAILED",
    strategy: "MARKET",
    quantity: "100",
    error: "Insufficient balance",
    createdAt: new Date(Date.now() - 8 * 60 * 1000),
    executionTime: 456,
    value: 0
  },
  {
    id: "trade_004",
    symbol: "DOTUSDT",
    status: "SUCCESS",
    strategy: "MARKET",
    quantity: "1",
    executedPrice: "7.85",
    executedQuantity: "1",
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
    executionTime: 298,
    value: 7.85
  },
];

const mockStats = {
  totalTrades: 156,
  successfulTrades: 142,
  failedTrades: 14,
  successRate: 91.0,
  averageExecutionTime: 267,
  totalValue: 8234.56,
  averageTradeValue: 52.34,
};

export function TradeStatus() {
  const [trades, _setTrades] = useState(mockTradeHistory);
  const [stats, _setStats] = useState(mockStats);
  const [isLoading, setIsLoading] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [strategy, setStrategy] = useState<"MARKET" | "LIMIT">("MARKET");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchTradeData();
    const interval = setInterval(fetchTradeData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTradeData = async () => {
    try {
      // Replace with actual API calls
      // const [tradesResponse, statsResponse] = await Promise.all([
      //   fetch('/api/trading/history'),
      //   fetch('/api/trading/stats')
      // ]);
      // const tradesData = await tradesResponse.json();
      // const statsData = await statsResponse.json();
      // setTrades(tradesData.trades);
      // setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch trade data:', error);
    }
  };

  const handleManualTrade = async () => {
    if (!symbol) return;

    setIsLoading(true);
    try {
      // Replace with actual API call
      // const response = await fetch('/api/trading/execute-manual-trade', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ symbol, strategy })
      // });
      // await response.json();
      
      setIsDialogOpen(false);
      setSymbol("");
      await fetchTradeData();
    } catch (error) {
      console.error('Failed to execute manual trade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "default";
      case "FAILED":
        return "destructive";
      case "PENDING":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulTrades} successful, {stats.failedTrades} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              Target: &gt;90%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageExecutionTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Target: &lt;500ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg: ${stats.averageTradeValue}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Trade Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Manual Trade
          </CardTitle>
          <CardDescription>
            Execute a manual trade for any supported symbol
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., BTCUSDT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              />
            </div>
            <div className="w-32">
              <Label htmlFor="strategy">Strategy</Label>
              <Select value={strategy} onValueChange={(value: "MARKET" | "LIMIT") => setStrategy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET">Market</SelectItem>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="mt-6" 
                  disabled={!symbol || isLoading}
                  onClick={() => setIsDialogOpen(true)}
                >
                  Execute Trade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Manual Trade</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to execute a {strategy.toLowerCase()} trade for {symbol}?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleManualTrade} disabled={isLoading}>
                    {isLoading ? "Executing..." : "Confirm Trade"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Trades
            </div>
            <Badge variant="outline">{trades.length} trades</Badge>
          </CardTitle>
          <CardDescription>
            Latest trade executions with performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {trade.status === "SUCCESS" ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">{trade.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {trade.strategy} • {trade.quantity}
                      </div>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(trade.status)}>
                    {trade.status}
                  </Badge>
                </div>

                <div className="text-right">
                  <div className="font-medium">
                    {trade.status === "SUCCESS" ? `$${trade.value.toFixed(2)}` : "Failed"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {trade.status === "SUCCESS" && (
                      <>@{trade.executedPrice}</>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(trade.createdAt)} • {trade.executionTime}ms
                  </div>
                </div>
              </div>
            ))}

            {trades.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No trades executed yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            Trade execution performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Performance chart will be implemented here</p>
              <p className="text-sm">Showing execution times and success rates</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
