"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  Clock, 
  DollarSign,
  Activity,
  Eye,
  Target,
  AlertCircle,
  Filter,
  RefreshCw,
  ExternalLink
} from "lucide-react";

// Mock data - will be replaced with real API calls
const mockListingEvents = [
  {
    id: "listing_001",
    symbol: "PEPEUSDT",
    eventType: "NEW_LISTING_DETECTED",
    price: "0.00001234",
    detectedAt: new Date(Date.now() - 2 * 60 * 1000),
    metadata: {
      detectionMethod: "API_POLLING",
      volume: "1.2M",
      change24h: "+15.4%"
    }
  },
  {
    id: "listing_002",
    symbol: "SHIBUSDT",
    eventType: "NEW_LISTING_DETECTED",
    price: "0.00000856",
    detectedAt: new Date(Date.now() - 5 * 60 * 1000),
    metadata: {
      detectionMethod: "API_POLLING",
      volume: "890K",
      change24h: "+8.2%"
    }
  },
  {
    id: "listing_003",
    symbol: "FLOKIUSDT",
    eventType: "NEW_LISTING_DETECTED",
    price: "0.00014567",
    detectedAt: new Date(Date.now() - 8 * 60 * 1000),
    metadata: {
      detectionMethod: "API_POLLING",
      volume: "567K",
      change24h: "-2.1%"
    }
  },
  {
    id: "listing_004",
    symbol: "BABYDOGEUSDT",
    eventType: "NEW_LISTING_DETECTED",
    price: "0.00000234",
    detectedAt: new Date(Date.now() - 15 * 60 * 1000),
    metadata: {
      detectionMethod: "API_POLLING",
      volume: "2.3M",
      change24h: "+22.7%"
    }
  },
];

const mockStats = {
  totalListings: 47,
  todayListings: 12,
  averagePrice: 0.00002345,
  mostActiveHour: "14:00-15:00",
  detectionAccuracy: 98.5,
};

export function ListingEvents() {
  const [listings, setListings] = useState(mockListingEvents);
  const [stats, setStats] = useState(mockStats);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [timeRange, setTimeRange] = useState("24h");

  useEffect(() => {
    fetchListingData();
    const interval = setInterval(fetchListingData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchListingData = async () => {
    try {
      // Replace with actual API calls
      // const [listingsResponse, statsResponse] = await Promise.all([
      //   fetch(`/api/trading/recent-listings?hours=${timeRange}`),
      //   fetch('/api/trading/detector-stats')
      // ]);
      // const listingsData = await listingsResponse.json();
      // const statsData = await statsResponse.json();
      // setListings(listingsData.listings);
      // setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch listing data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchListingData();
    setIsLoading(false);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const filteredListings = listings.filter(listing =>
    listing.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  const getPriceChangeColor = (change: string) => {
    if (change.startsWith('+')) return 'text-green-600';
    if (change.startsWith('-')) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num < 0.000001) {
      return `$${num.toExponential(2)}`;
    }
    return `$${num.toFixed(8)}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalListings}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayListings}</div>
            <p className="text-xs text-muted-foreground">
              New listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.averagePrice.toString())}</div>
            <p className="text-xs text-muted-foreground">
              Per token
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mostActiveHour}</div>
            <p className="text-xs text-muted-foreground">
              Most active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.detectionAccuracy}%</div>
            <p className="text-xs text-muted-foreground">
              Detection rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Listing Events
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredListings.length} events</Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time detection of new MEXC listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="filter">Filter by symbol</Label>
              <Input
                id="filter"
                placeholder="e.g., PEPE, SHIB..."
                value={filter}
                onChange={(e) => setFilter(e.target.value.toUpperCase())}
              />
            </div>
            <div className="w-32">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="6h">6 Hours</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">{listing.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {listing.metadata?.detectionMethod || "API_POLLING"}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {listing.eventType.replace("_", " ")}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <div className="font-medium">{formatPrice(listing.price)}</div>
                      <div className={`text-xs ${getPriceChangeColor(listing.metadata?.change24h || "")}`}>
                        {listing.metadata?.change24h || "0%"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Volume</div>
                      <div className="font-medium">{listing.metadata?.volume || "N/A"}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(listing.detectedAt)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredListings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No listing events found</p>
                {filter && (
                  <p className="text-sm">Try adjusting your filter</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detection Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Timeline</CardTitle>
            <CardDescription>
              Listing detections over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
              <div className="text-center text-muted-foreground">
                <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>Timeline chart will be implemented here</p>
                <p className="text-sm">Showing hourly detection patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detection Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Sources</CardTitle>
            <CardDescription>
              Breakdown of detection methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>API Polling</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">45 events</span>
                  <Badge variant="outline">95.7%</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Webhook</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">2 events</span>
                  <Badge variant="outline">4.3%</Badge>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Detection Performance</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                API polling is the primary detection method with 95.7% accuracy.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
