"use client";

import { Calendar, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMexcCalendar, useRefreshMexcCalendar } from "@/hooks/use-mexc-data";

type UpcomingCalendarEntry = {
  firstOpenTime?: string | number;
  vcoinId?: string;
  symbol?: string;
  projectName?: string;
  vcoinName?: string;
  vcoinNameFull?: string;
};

type GroupedLaunches = {
  today: UpcomingCalendarEntry[];
  tomorrow: UpcomingCalendarEntry[];
};

export function UpcomingCoinsSection() {
  // Use the main calendar hook to get all data instead of filtered data
  const { data: allCalendarData, isLoading, error } = useMexcCalendar();
  const refreshCalendar = useRefreshMexcCalendar();

  // Group launches by today/tomorrow and sort by earliest launch time
  const groupedLaunches = useMemo<GroupedLaunches>(() => {
    if (!Array.isArray(allCalendarData)) {
      return { today: [], tomorrow: [] };
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfTomorrow = new Date(
      startOfToday.getTime() + 24 * 60 * 60 * 1000
    );
    const endOfTomorrow = new Date(
      startOfTomorrow.getTime() + 24 * 60 * 60 * 1000
    );

    const today: UpcomingCalendarEntry[] = [];
    const tomorrow: UpcomingCalendarEntry[] = [];

    for (const entry of allCalendarData) {
      try {
        if (!entry.firstOpenTime) {
          continue;
        }
        const launchTime = new Date(entry.firstOpenTime);

        if (launchTime >= startOfToday && launchTime < startOfTomorrow) {
          today.push(entry);
        } else if (
          launchTime >= startOfTomorrow &&
          launchTime < endOfTomorrow
        ) {
          tomorrow.push(entry);
        }
      } catch (_error) {
        console.warn("Invalid date in calendar entry:", {
          firstOpenTime: entry.firstOpenTime,
        });
      }
    }

    // Sort by earliest launch time (ascending)
    const sortByLaunchTime = (
      a: UpcomingCalendarEntry,
      b: UpcomingCalendarEntry
    ) => {
      const timeA = a.firstOpenTime ? new Date(a.firstOpenTime).getTime() : 0;
      const timeB = b.firstOpenTime ? new Date(b.firstOpenTime).getTime() : 0;
      return timeA - timeB;
    };

    today.sort(sortByLaunchTime);
    tomorrow.sort(sortByLaunchTime);

    return { today, tomorrow };
  }, [allCalendarData]);

  const formatLaunchTime = (firstOpenTime: string | number) => {
    try {
      const date = new Date(firstOpenTime);
      return {
        time: date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        hoursUntil: Math.floor(
          (date.getTime() - Date.now()) / (1000 * 60 * 60)
        ),
      };
    } catch {
      return { time: "Invalid time", hoursUntil: 0 };
    }
  };

  const getTimeUntilColor = (hoursUntil: number) => {
    if (hoursUntil <= 2) {
      return "bg-red-500/10 text-red-600 border-red-500/20";
    }
    if (hoursUntil <= 6) {
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    }
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load upcoming coins</p>
            <p className="mt-1 text-sm">{error.message}</p>
            <Button
              className="mt-3"
              disabled={refreshCalendar.isPending}
              onClick={() => refreshCalendar.mutate()}
              size="sm"
              variant="outline"
            >
              {refreshCalendar.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Information Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <div className="rounded bg-blue-500/10 p-1">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 text-sm dark:text-blue-100">
              About Token Names
            </h3>
            <p className="mt-1 text-blue-700 text-xs dark:text-blue-200">
              MEXC reveals actual token names and symbols closer to launch time
              for security reasons. Current entries show placeholder IDs that
              will be updated with real names as launch approaches.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Launches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-600">Today's Launches</CardTitle>
            <Badge
              className="border-green-500/20 bg-green-500/10 text-green-600"
              variant="secondary"
            >
              {groupedLaunches.today.length}
            </Badge>
          </div>
          <CardDescription>
            Coins launching today - sorted by earliest launch time
            <Badge className="ml-2 text-xs" variant="outline">
              Total in calendar: {allCalendarData?.length || 0}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedLaunches.today.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No coins launching today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedLaunches.today.map((entry, index) => {
                const { time, hoursUntil } = formatLaunchTime(
                  entry.firstOpenTime || ""
                );
                return (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    key={`${entry.vcoinId}-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-500/10 p-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {entry.projectName !== entry.vcoinId
                            ? entry.projectName
                            : entry.vcoinNameFull ||
                              entry.vcoinName ||
                              `Upcoming Launch #${index + 1}`}
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {entry.symbol !== entry.vcoinId
                            ? entry.symbol
                            : `${entry.vcoinId?.slice(0, 6)?.toUpperCase()}...`}
                        </p>
                        <p className="text-orange-600 text-xs">
                          ⏳ Token name revealed closer to launch
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-medium text-sm">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge
                          className={getTimeUntilColor(hoursUntil)}
                          variant="outline"
                        >
                          {hoursUntil <= 0 ? "Now" : `${hoursUntil}h`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tomorrow's Launches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-600">Tomorrow's Launches</CardTitle>
            <Badge
              className="border-blue-500/20 bg-blue-500/10 text-blue-600"
              variant="secondary"
            >
              {groupedLaunches.tomorrow.length}
            </Badge>
          </div>
          <CardDescription>
            Coins launching tomorrow - sorted by earliest launch time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedLaunches.tomorrow.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No coins launching tomorrow</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedLaunches.tomorrow.map((entry, index) => {
                const { time, hoursUntil } = formatLaunchTime(
                  entry.firstOpenTime || ""
                );
                return (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    key={`${entry.vcoinId}-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {entry.projectName !== entry.vcoinId
                            ? entry.projectName
                            : entry.vcoinNameFull ||
                              entry.vcoinName ||
                              `Tomorrow Launch #${index + 1}`}
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {entry.symbol !== entry.vcoinId
                            ? entry.symbol
                            : `${entry.vcoinId?.slice(0, 6)?.toUpperCase()}...`}
                        </p>
                        <p className="text-orange-600 text-xs">
                          ⏳ Token name revealed closer to launch
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-medium text-sm">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge
                          className={getTimeUntilColor(hoursUntil)}
                          variant="outline"
                        >
                          {hoursUntil}h
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Upcoming launches (next 48h):{" "}
              <span className="font-medium text-foreground">
                {groupedLaunches.today.length + groupedLaunches.tomorrow.length}
              </span>
              {Array.isArray(allCalendarData) && (
                <span className="ml-2">
                  (Total: {allCalendarData.length} in calendar)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Badge
                className="border-green-500/20 bg-green-500/10 text-green-600"
                variant="outline"
              >
                Today: {groupedLaunches.today.length}
              </Badge>
              <Badge
                className="border-blue-500/20 bg-blue-500/10 text-blue-600"
                variant="outline"
              >
                Tomorrow: {groupedLaunches.tomorrow.length}
              </Badge>
              <Button
                disabled={refreshCalendar.isPending}
                onClick={() => refreshCalendar.mutate()}
                size="sm"
                variant="ghost"
              >
                {refreshCalendar.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Add default export for dynamic imports
export default UpcomingCoinsSection;
