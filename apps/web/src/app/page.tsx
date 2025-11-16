"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  LineChart,
  Plus,
  Radar,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useState } from "react";
import { BotControlPanel } from "@/components/bot-control-panel";
import { ConfigurationForm } from "@/components/configuration-form";
import { ConfigurationList } from "@/components/configuration-list";
import { ListingEvents } from "@/components/listing-events";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const heroHighlights = [
  {
    icon: Radar,
    label: "Listings Monitor",
    value: "Live calendar feed",
  },
  {
    icon: ShieldCheck,
    label: "Safety Guardrails",
    value: "Rate limits & recv windows",
  },
  {
    icon: Target,
    label: "Sniping Focus",
    value: "Ultra-fast execution",
  },
];

const metricCards = [
  {
    title: "Automation",
    value: "Always-on",
    description: "Effect-driven orchestrator",
    icon: Activity,
  },
  {
    title: "Listings",
    value: "Calendar + Signals",
    description: "Real-time upstream data",
    icon: CalendarDays,
  },
  {
    title: "Performance",
    value: "< 250ms",
    description: "Average latency target",
    icon: LineChart,
  },
  {
    title: "Strategies",
    value: "Configurable",
    description: "Custom safety & spend",
    icon: BarChart3,
  },
];

const readinessChecklist = [
  "Heartbeat < 5s (websocket monitor)",
  "Safety toggles enforced before launch",
  "Manual override available in bot panel",
];

export default function Home() {
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      {/* Hero */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-primary/90 to-primary-foreground text-primary-foreground shadow-xl">
          <CardHeader className="relative z-10 text-white">
            <Badge className="w-fit bg-white/20 text-white" variant="secondary">
              Live control center
            </Badge>
            <CardTitle className="text-3xl sm:text-4xl">
              MEXC Sniperbot Operations
            </CardTitle>
            <CardDescription className="text-white/80">
              Orchestrate listings surveillance, execute safeguarded snipes, and
              iterate on strategies with instant feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-6 text-white">
            <div className="grid gap-4 sm:grid-cols-3">
              {heroHighlights.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <div
                    className="rounded-xl border border-white/20 bg-white/10 p-4"
                    key={highlight.label}
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm text-white/70 uppercase tracking-wide">
                      <Icon className="h-4 w-4" />
                      {highlight.label}
                    </div>
                    <p className="font-semibold text-white">
                      {highlight.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <Dialog onOpenChange={setShowConfigDialog} open={showConfigDialog}>
              <div className="flex flex-wrap gap-3">
                <DialogTrigger asChild>
                  <Button className="text-base" size="lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Launch configuration builder
                  </Button>
                </DialogTrigger>
                <Button
                  className="bg-white/20 text-white hover:bg-white/30"
                  size="lg"
                  variant="secondary"
                >
                  View runbooks
                </Button>
              </div>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create configuration</DialogTitle>
                  <DialogDescription>
                    Define trading parameters, symbols, and safety rails for the
                    bot before activating it.
                  </DialogDescription>
                </DialogHeader>
                <ConfigurationForm
                  onCancel={() => setShowConfigDialog(false)}
                  onSuccess={() => setShowConfigDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_60%)]" />
        </Card>

        <Card className="h-full border-primary/20">
          <CardHeader>
            <CardTitle>Operational readiness</CardTitle>
            <CardDescription>
              Key guardrails before firing the bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readinessChecklist.map((item) => (
              <div className="flex items-start gap-3" key={item}>
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                <p className="text-muted-foreground text-sm">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card className="h-full" key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-bold text-2xl">{metric.value}</div>
                <p className="text-muted-foreground text-sm">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Control & telemetry */}
      <Tabs className="space-y-4" defaultValue="control">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="control">Bot control & strategy</TabsTrigger>
          <TabsTrigger value="listings">Listings telemetry</TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-4" value="control">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <BotControlPanel className="h-full" />
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Configuration studio</CardTitle>
                <CardDescription>
                  Draft presets, tune spend and rate limits, then persist to the
                  cluster.
                </CardDescription>
              </CardHeader>
              <ConfigurationForm />
            </Card>
          </div>
        </TabsContent>
        <TabsContent className="space-y-4" value="listings">
          <ListingEvents />
        </TabsContent>
      </Tabs>

      {/* Configurations + insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Configurations</CardTitle>
            <CardDescription>
              Ready-to-use setups synced with the trading engine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigurationList />
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Execution insights</CardTitle>
            <CardDescription>
              High-level notes to keep the operator focused on the right
              milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium">Listings timeline</p>
              <p className="text-muted-foreground text-sm">
                Keep the Listings tab open during launches to validate calendar
                parity and confirm symbol propagation.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium">Manual override</p>
              <p className="text-muted-foreground text-sm">
                Any timeout or throttling incident should be followed by a stop
                + restart using the Bot Control panel to rehydrate state.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium">Safety envelope</p>
              <p className="text-muted-foreground text-sm">
                Rate limits, recv windows, and spend caps live inside each
                configuration — keep them conservative before live trading.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
