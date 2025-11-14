"use client";

import { ConfigPreview } from "@/components/config-preview";
import { ConfigReset } from "@/components/config-reset";
import { ErrorBoundary } from "@/components/error-boundary";
import { RiskSettings } from "@/components/risk-settings";
import { SellStrategySettings } from "@/components/sell-strategy-settings";
import { TradingForm } from "@/components/trading-form";

export default function SettingsPage() {
  return (
    <ErrorBoundary>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Configure trading parameters and risk management
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Forms */}
          <div className="space-y-6 lg:col-span-2">
            <TradingForm />
            <RiskSettings />
            <SellStrategySettings />
          </div>

          {/* Right Column - Preview & Reset */}
          <div className="space-y-6">
            <ConfigPreview />
            <ConfigReset />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
