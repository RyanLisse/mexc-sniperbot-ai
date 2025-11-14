import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Star } from "lucide-react";
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

// Component-local types that match the serialized tRPC response
type SerializedCoinForecast = {
  symbol: string;
  name: string;
  releaseDate: string; // ISO string from tRPC
  potential: number;
  forecast: number;
};

type SerializedUpcomingCoinsResponse = {
  today: SerializedCoinForecast[];
  tomorrow: SerializedCoinForecast[];
  all: SerializedCoinForecast[];
};

type ForecastFilter = "all" | "today" | "tomorrow";

export function ForecastTable() {
  const [filter, setFilter] = useState<ForecastFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["forecast", "upcoming-coins"],
    queryFn: async (): Promise<SerializedUpcomingCoinsResponse> => {
      const result = await trpcClient.forecast.getUpcomingCoins.query();
      return result;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const getFilteredData = () => {
    if (!data) {
      return [];
    }
    switch (filter) {
      case "today":
        return data.today;
      case "tomorrow":
        return data.tomorrow;
      default:
        return data.all;
    }
  };

  const renderStars = (potential: number) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          className={`h-4 w-4 ${
            star <= potential
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          }`}
          key={star}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Coins</CardTitle>
          <CardDescription>Forecast for upcoming listings</CardDescription>
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
          <CardTitle>Upcoming Coins</CardTitle>
          <CardDescription>Forecast for upcoming listings</CardDescription>
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
            <CardTitle>Upcoming Coins</CardTitle>
            <CardDescription>Forecast for upcoming listings</CardDescription>
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
          <p className="py-8 text-center text-muted-foreground">
            No upcoming listings found
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Release</TableHead>
                <TableHead>Potential</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((coin: SerializedCoinForecast) => (
                <TableRow key={coin.symbol}>
                  <TableCell className="font-medium">{coin.symbol}</TableCell>
                  <TableCell>{coin.name}</TableCell>
                  <TableCell>
                    {format(new Date(coin.releaseDate), "MMM dd")}
                  </TableCell>
                  <TableCell>{renderStars(coin.potential)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      coin.forecast >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {coin.forecast >= 0 ? "+" : ""}
                    {coin.forecast.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
