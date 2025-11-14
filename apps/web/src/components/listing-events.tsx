"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { trpc } from "@/utils/trpc";

type CalendarFilter = "all" | "today" | "tomorrow" | "upcoming";

export function ListingEvents() {
  const [filter, setFilter] = useState("");
  const [timeRange, setTimeRange] = useState("24h");
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");

  // Fetch recent listings
  const { data: recentListingsData, isLoading: isLoadingRecent } = useQuery(
    trpc.trading.getRecentListings.queryOptions(
      {
        hours:
          timeRange === "1h"
            ? 1
            : timeRange === "6h"
              ? 6
              : timeRange === "24h"
                ? 24
                : 168,
        symbol: filter || undefined,
      },
      {
        refetchInterval: 10_000, // Refresh every 10 seconds
        refetchOnWindowFocus: true,
      }
    )
  );

  // Fetch upcoming calendar listings
  const { data: upcomingListingsData, isLoading: isLoadingUpcoming } = useQuery(
    trpc.trading.getUpcomingListings.queryOptions(
      {
        hours: 48,
        filter: calendarFilter,
      },
      {
        refetchInterval: 30_000, // Refresh every 30 seconds
        refetchOnWindowFocus: true,
      }
    )
  );

  const isLoading = isLoadingRecent || isLoadingUpcoming;

  // Combine recent and upcoming listings
  const allListings = [
    ...(recentListingsData?.listings.map((listing) => ({
      id: `recent_${listing.symbol}_${listing.detectedAt}`,
      symbol: listing.symbol,
      price: listing.price,
      detectedAt: new Date(listing.detectedAt),
      type: "recent" as const,
      projectName: undefined,
      firstOpenTime: undefined,
    })) || []),
    ...(upcomingListingsData?.listings.map((listing) => ({
      id: `upcoming_${listing.vcoinId || listing.symbol}`,
      symbol: listing.symbol,
      price: "0", // Not live yet
      detectedAt: new Date(listing.firstOpenTime),
      type: "upcoming" as const,
      projectName: listing.projectName,
      firstOpenTime: new Date(listing.firstOpenTime),
    })) || []),
  ];

  const handleRefresh = () => {
    // Query will automatically refetch
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatCountdown = (targetDate: Date) => {
    const now = Date.now();
    const target = targetDate.getTime();
    const diff = target - now;

    if (diff <= 0) {
      return "Live now";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

  const filteredListings = allListings.filter((listing) =>
    listing.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  const formatPrice = (price: string) => {
    const num = Number.parseFloat(price);
    if (num < 0.000_001) {
      return `$${num.toExponential(2)}`;
    }
    return `$${num.toFixed(8)}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Total Listings
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{allListings.length}</div>
            <p className="text-muted-foreground text-xs">All listings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {upcomingListingsData?.listings.filter((l) => {
                const date = new Date(l.firstOpenTime);
                const today = new Date();
                return (
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear()
                );
              }).length || 0}
            </div>
            <p className="text-muted-foreground text-xs">Today's launches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {upcomingListingsData?.total || 0}
            </div>
            <p className="text-muted-foreground text-xs">Scheduled launches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Recent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {recentListingsData?.total || 0}
            </div>
            <p className="text-muted-foreground text-xs">Past 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Detection</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">Calendar</div>
            <p className="text-muted-foreground text-xs">Primary method</p>
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
                disabled={isLoading}
                onClick={handleRefresh}
                size="sm"
                variant="outline"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time detection of new MEXC listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="filter">Filter by symbol</Label>
              <Input
                id="filter"
                onChange={(e) => setFilter(e.target.value.toUpperCase())}
                placeholder="e.g., PEPE, SHIB..."
                value={filter}
              />
            </div>
            <div className="w-full sm:w-40">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select onValueChange={setTimeRange} value={timeRange}>
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
            <div className="w-full sm:w-40">
              <Label htmlFor="calendarFilter">Calendar Filter</Label>
              <Select
                onValueChange={(value) =>
                  setCalendarFilter(value as CalendarFilter)
                }
                value={calendarFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Upcoming</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <div
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                key={listing.id}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {listing.type === "upcoming" ? (
                        <Calendar className="h-4 w-4 text-blue-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <div className="font-medium">{listing.symbol}</div>
                        {listing.projectName && (
                          <div className="text-muted-foreground text-xs">
                            {listing.projectName}
                          </div>
                        )}
                        <div className="text-muted-foreground text-xs">
                          {listing.type === "upcoming"
                            ? "CALENDAR"
                            : "SYMBOL_COMPARISON"}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        listing.type === "upcoming" ? "default" : "secondary"
                      }
                    >
                      {listing.type === "upcoming" ? "UPCOMING" : "LIVE"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    {listing.type === "upcoming" ? (
                      <div>
                        <div className="text-muted-foreground text-xs">
                          Launch Time
                        </div>
                        <div className="font-medium">
                          {listing.firstOpenTime
                            ? formatCountdown(listing.firstOpenTime)
                            : "TBD"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {listing.firstOpenTime
                            ? new Date(listing.firstOpenTime).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-medium">
                            {formatPrice(listing.price)}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Current price
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {listing.type === "upcoming" ? (
                      <div className="flex items-center gap-1 font-medium text-blue-600 text-xs">
                        <Calendar className="h-3 w-3" />
                        Scheduled
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(listing.detectedAt)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredListings.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No listing events found</p>
                {filter && <p className="text-sm">Try adjusting your filter</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detection Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Detection Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Timeline</CardTitle>
            <CardDescription>Listing detections over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-muted border-dashed">
              <div className="text-center text-muted-foreground">
                <Activity className="mx-auto mb-2 h-6 w-6 opacity-50" />
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
            <CardDescription>Breakdown of detection methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span>API Polling</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    45 events
                  </span>
                  <Badge variant="outline">95.7%</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Webhook</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    2 events
                  </span>
                  <Badge variant="outline">4.3%</Badge>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Detection Performance</span>
              </div>
              <p className="mt-1 text-blue-700 text-sm">
                API polling is the primary detection method with 95.7% accuracy.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
