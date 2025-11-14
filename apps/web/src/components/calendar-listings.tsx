"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpcClient } from "@/utils/trpc";

type CalendarFilter = "all" | "today" | "tomorrow";

interface CalendarEntry {
  vcoinId: string;
  symbol: string;
  vcoinName?: string;
  vcoinNameFull?: string;
  firstOpenTime: number;
  zone?: string;
}

export function CalendarListings() {
  const [filter, setFilter] = useState<CalendarFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["calendar", "listings"],
    queryFn: async (): Promise<CalendarEntry[]> => {
      const result = await trpcClient.calendar.getCalendarListings.query();
      return result ?? [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60_000, // Refetch every minute
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const getFilteredData = () => {
    if (!data) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    switch (filter) {
      case "today":
        return data.filter((entry) => {
          const entryDate = new Date(entry.firstOpenTime);
          return entryDate >= today && entryDate < tomorrow;
        });
      case "tomorrow":
        return data.filter((entry) => {
          const entryDate = new Date(entry.firstOpenTime);
          return entryDate >= tomorrow && entryDate < dayAfterTomorrow;
        });
      default:
        return data.filter((entry) => {
          const entryDate = new Date(entry.firstOpenTime);
          return entryDate >= today; // Only show future listings
        });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            New Coin Listings
          </CardTitle>
          <CardDescription>Loading MEXC calendar data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton className="h-12 w-full" key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            New Coin Listings
          </CardTitle>
          <CardDescription>Error loading calendar data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            Failed to load calendar data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filteredData = getFilteredData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              New Coin Listings
            </CardTitle>
            <CardDescription>Upcoming MEXC coin launches</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setFilter("all")}
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
            >
              All
            </Button>
            <Button
              onClick={() => setFilter("today")}
              size="sm"
              variant={filter === "today" ? "default" : "outline"}
            >
              Today
            </Button>
            <Button
              onClick={() => setFilter("tomorrow")}
              size="sm"
              variant={filter === "tomorrow" ? "default" : "outline"}
            >
              Tomorrow
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No upcoming listings found</p>
            {filter !== "all" && (
              <p className="text-sm">
                Try selecting "All" to see more listings
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Launch Time</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((entry) => {
                const launchTime = new Date(entry.firstOpenTime);
                const now = new Date();
                const hoursUntilLaunch =
                  (launchTime.getTime() - now.getTime()) / (1000 * 60 * 60);

                return (
                  <TableRow key={entry.vcoinId}>
                    <TableCell className="font-medium font-mono">
                      {entry.symbol}
                    </TableCell>
                    <TableCell>
                      {entry.vcoinNameFull || entry.vcoinName || entry.symbol}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{format(launchTime, "MMM dd, yyyy")}</span>
                        <span className="text-muted-foreground text-sm">
                          {format(launchTime, "HH:mm")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm">
                          {hoursUntilLaunch > 24
                            ? `${Math.floor(hoursUntilLaunch / 24)}d`
                            : `${Math.floor(hoursUntilLaunch)}h`}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {data && (
          <div className="mt-4 text-center text-muted-foreground text-sm">
            Total listings: {data.length} | Showing: {filteredData.length}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
