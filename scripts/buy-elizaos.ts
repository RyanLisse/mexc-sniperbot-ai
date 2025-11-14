#!/usr/bin/env bun
/**
 * Script to execute a manual buy order for ELIZAOS token
 * Usage: bun run scripts/buy-elizaos.ts
 */

import { Effect } from "effect";
import { TradingLogger } from "../packages/api/src/lib/effect";
import { tradingOrchestrator } from "../packages/api/src/services/trading-orchestrator";

const SYMBOL = "ELIZAOS/USDT";

async function buyElizaos() {
  console.log(`🚀 Attempting to buy ${SYMBOL}...`);
  console.log("");

  try {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TradingLogger.logInfo(`Starting manual trade for ${SYMBOL}`);

        // Ensure bot is running
        const status = yield* tradingOrchestrator.getBotStatus();
        if (!status.isRunning) {
          console.log("⚠️  Bot is not running. Starting bot...");
          yield* tradingOrchestrator.startTradingBot();
          console.log("✅ Bot started successfully");
          console.log("");
        }

        // Execute the manual trade
        yield* tradingOrchestrator.executeManualTrade(SYMBOL);

        yield* TradingLogger.logInfo(
          `Manual trade executed successfully for ${SYMBOL}`
        );

        return {
          success: true,
          symbol: SYMBOL,
          timestamp: new Date().toISOString(),
        };
      })
    );

    console.log("✅ Trade executed successfully!");
    console.log(`   Symbol: ${result.symbol}`);
    console.log(`   Timestamp: ${result.timestamp}`);
    console.log("");
    console.log("📊 Check your portfolio or trade history for details.");
  } catch (error) {
    console.error("❌ Trade execution failed:");
    console.error("");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error("");
        console.error("Stack trace:");
        console.error(error.stack);
      }
    } else {
      console.error("   Unknown error:", error);
    }

    process.exit(1);
  }
}

// Run the script
buyElizaos()
  .then(() => {
    console.log("");
    console.log("✨ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
