"use client";

import { BotStatus } from "@/components/bot-status";

export default function Dashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">MEXC Sniper Bot Dashboard</h1>
      <p className="mt-4">Dashboard is loading successfully!</p>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Bot Status</h2>
        <BotStatus />
      </div>
    </div>
  );
}
