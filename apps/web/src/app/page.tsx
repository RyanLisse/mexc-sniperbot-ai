"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { BotControlPanel } from "@/components/bot-control-panel";
import { ConfigurationForm } from "@/components/configuration-form";
import { ConfigurationList } from "@/components/configuration-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TITLE_TEXT = `
 ███╗   ███╗███████╗██╗  ██╗ ██████╗    ███████╗███╗   ██╗██╗██████╗ ███████╗██████╗
 ████╗ ████║██╔════╝╚██╗██╔╝██╔════╝    ██╔════╝████╗  ██║██║██╔══██╗██╔════╝██╔══██╗
 ██╔████╔██║█████╗   ╚███╔╝ ██║         ███████╗██╔██╗ ██║██║██████╔╝█████╗  ██████╔╝
 ██║╚██╔╝██║██╔══╝   ██╔██╗ ██║         ╚════██║██║╚██╗██║██║██╔═══╝ ██╔══╝  ██╔══██╗
 ██║ ╚═╝ ██║███████╗██╔╝ ██╗╚██████╗    ███████║██║ ╚████║██║██║     ███████╗██║  ██║
 ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝
`;

export default function Home() {
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="space-y-2">
        <pre className="overflow-x-auto font-mono text-gray-600 text-xs dark:text-gray-400">
          {TITLE_TEXT}
        </pre>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl">Trading Bot Control</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage configurations and control the MEXC sniping bot
            </p>
          </div>
          <Dialog onOpenChange={setShowConfigDialog} open={showConfigDialog}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Configuration</DialogTitle>
                <DialogDescription>
                  Define trading parameters and safety limits for the bot
                </DialogDescription>
              </DialogHeader>
              <ConfigurationForm
                onCancel={() => setShowConfigDialog(false)}
                onSuccess={() => setShowConfigDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Bot Control Panel */}
        <div>
          <BotControlPanel />
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-gray-500 text-sm">Configurations</p>
              <p className="font-bold text-2xl">-</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-gray-500 text-sm">Trades Today</p>
              <p className="font-bold text-2xl">-</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-gray-500 text-sm">Success Rate</p>
              <p className="font-bold text-2xl">-</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-gray-500 text-sm">Avg Latency</p>
              <p className="font-bold text-2xl">-</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configurations List */}
      <div>
        <ConfigurationList />
      </div>
    </div>
  );
}
