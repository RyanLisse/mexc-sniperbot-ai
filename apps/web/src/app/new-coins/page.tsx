"use client";

import { UpcomingCoinsSection } from "@/components/dashboard/upcoming-coins-section";
import { ErrorBoundary } from "@/components/error-boundary";
import { ForecastTable } from "@/components/forecast-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NewCoinsPage() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="font-bold text-3xl tracking-tight">New Coins</h1>
          <p className="mt-1 text-muted-foreground">
            Upcoming coin listings with price forecasts
          </p>
        </div>

        {/* Tabs for different views */}
        <Tabs className="w-full" defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Today & Tomorrow</TabsTrigger>
            <TabsTrigger value="forecast">Forecast Analysis</TabsTrigger>
          </TabsList>
          <TabsContent className="mt-6" value="upcoming">
            <UpcomingCoinsSection />
          </TabsContent>
          <TabsContent className="mt-6" value="forecast">
            <ForecastTable />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
