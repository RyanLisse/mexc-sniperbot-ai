#!/usr/bin/env bun
/**
 * Script to fetch and display today's and tomorrow's new coin listings
 * Usage: bun run scripts/get-new-coins.ts
 */

import { Effect } from "effect";
import { forecastService } from "../packages/api/src/services/forecast-service";

async function getNewCoins() {
  console.log("🔍 Fetching new coin listings for today and tomorrow...\n");

  try {
    const result = await Effect.runPromise(
      forecastService.getUpcomingListings().pipe(
        Effect.catchAll((error) => {
          console.error("❌ Error fetching listings:", error);
          return Effect.succeed({
            today: [],
            tomorrow: [],
            all: [],
          });
        })
      )
    );

    console.log("=".repeat(60));
    console.log("📅 TODAY'S NEW COINS");
    console.log("=".repeat(60));

    if (result.today.length === 0) {
      console.log("   No new coins scheduled for today.\n");
    } else {
      result.today.forEach((coin, index) => {
        const stars = "⭐".repeat(coin.potential);
        const forecastSign = coin.forecast >= 0 ? "+" : "";
        console.log(`\n${index + 1}. ${coin.symbol} - ${coin.name}`);
        console.log(
          `   Release: ${coin.releaseDate.toLocaleDateString()} ${coin.releaseDate.toLocaleTimeString()}`
        );
        console.log(`   Potential: ${stars} (${coin.potential}/5)`);
        console.log(`   Forecast: ${forecastSign}${coin.forecast.toFixed(2)}%`);
      });
      console.log(`\n   Total: ${result.today.length} coin(s)\n`);
    }

    console.log("=".repeat(60));
    console.log("📅 TOMORROW'S NEW COINS");
    console.log("=".repeat(60));

    if (result.tomorrow.length === 0) {
      console.log("   No new coins scheduled for tomorrow.\n");
    } else {
      result.tomorrow.forEach((coin, index) => {
        const stars = "⭐".repeat(coin.potential);
        const forecastSign = coin.forecast >= 0 ? "+" : "";
        console.log(`\n${index + 1}. ${coin.symbol} - ${coin.name}`);
        console.log(
          `   Release: ${coin.releaseDate.toLocaleDateString()} ${coin.releaseDate.toLocaleTimeString()}`
        );
        console.log(`   Potential: ${stars} (${coin.potential}/5)`);
        console.log(`   Forecast: ${forecastSign}${coin.forecast.toFixed(2)}%`);
      });
      console.log(`\n   Total: ${result.tomorrow.length} coin(s)\n`);
    }

    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`   Today: ${result.today.length} coin(s)`);
    console.log(`   Tomorrow: ${result.tomorrow.length} coin(s)`);
    console.log(`   Total (7 days): ${result.all.length} coin(s)`);
    console.log("");
  } catch (error) {
    console.error("❌ Failed to fetch new coins:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error("   Unknown error:", error);
    }
    process.exit(1);
  }
}

// Run the script
getNewCoins()
  .then(() => {
    console.log("✨ Done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
