"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotStatus } from "@/components/bot-status";
import { TradeStatus } from "@/components/trade-status";
import { ListingEvents } from "@/components/listing-events";
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Power, 
  PowerOff,
  RefreshCw,
  DollarSign,
  Clock,
  Zap
} from "lucide-react";

// Mock data - will be replaced with real API calls
const mockStats = {
  totalTrades: 247,
  successRate: 94.2,
  averageExecutionTime: 287,
  totalValue: 125430.50,
  uptime: 99.8,
  newListings: 12,
  activeListings: 3,
};

const mockRecentActivity = [
  { id: 1, type: "trade", symbol: "BTCUSDT", status: "success", time: "2 min ago", value: "$1,234.56" },
  { id: 2, type: "listing", symbol: "ETHUSDT", status: "detected", time: "5 min ago", value: "New listing" },
  { id: 3, type: "trade", symbol: "ADAUSDT", status: "failed", time: "12 min ago", value: "$0.00" },
  { id: 4, type: "trade", symbol: "DOTUSDT", status: "success", time: "18 min ago", value: "$892.34" },
];

export default function DashboardPage() {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(mockStats);
  const [recentActivity, setRecentActivity] = useState(mockRecentActivity);

  useEffect(() => {
    // Fetch initial data
    fetchDashboardData();
    
    // Set up real-time updates
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Replace with actual API calls
      // const response = await fetch('/api/trading/stats');
      // const data = await response.json();
      // setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const handleBotToggle = async () => {
    setIsLoading(true);
    try {
      // Replace with actual API call
      // const response = await fetch(`/api/trading/control-bot`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ action: isBotRunning ? 'stop' : 'start' })
      // });
      // await response.json();
      
      setIsBotRunning(!isBotRunning);
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchDashboardData();
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MEXC Sniper Bot Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and control of your trading bot
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            onClick={handleBotToggle}
            disabled={isLoading}
            variant={isBotRunning ? "destructive" : "default"}
          >
            {isBotRunning ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Stop Bot
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Start Bot
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
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
              +2.1% from yesterday
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
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bot Status */}
            <div className="lg:col-span-1">
              <BotStatus isRunning={isBotRunning} />
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest trades and listing detections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {activity.type === "trade" ? (
                              <Activity className="h-4 w-4" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                            <span className="font-medium">{activity.symbol}</span>
                          </div>
                          <Badge variant={
                            activity.status === "success" ? "default" :
                            activity.status === "failed" ? "destructive" : "secondary"
                          }>
                            {activity.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{activity.value}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trading">
          <TradeStatus />
        </TabsContent>

        <TabsContent value="listings">
          <ListingEvents />
        </TabsContent>

        <TabsContent value="monitoring">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Real-time performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Bot Uptime</span>
                    <Badge variant="outline">{stats.uptime}%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>API Response Time</span>
                    <Badge variant="outline">234ms</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Memory Usage</span>
                    <Badge variant="outline">128MB</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Database Connections</span>
                    <Badge variant="outline">3/10</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Overall system status and alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Bot Service: Operational</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>MEXC API: Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Database: Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Memory Usage: Moderate</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Performance Notice</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    API response times are slightly elevated. Consider monitoring closely.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
