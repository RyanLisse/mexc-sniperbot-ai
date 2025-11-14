#!/usr/bin/env bun
/**
 * Direct script to check MEXC calendar API for today's and tomorrow's listings
 * Usage: bun run scripts/check-calendar-api.ts
 */

import axios from "axios";

const CALENDAR_API_URL = "https://www.mexc.com/api/operation/new_coin_calendar";

interface CalendarCoin {
  vcoinId?: string;
  id?: string;
  vcoinName?: string;
  symbol?: string;
  vcoinNameFull?: string;
  projectName?: string;
  firstOpenTime?: number;
  first_open_time?: number;
  zone?: string;
}

interface CalendarResponse {
  data?: {
    newCoins?: CalendarCoin[];
  };
}

function isTodayListing(firstOpenTime: number): boolean {
  if (!firstOpenTime) return false;
  const listingDate = new Date(firstOpenTime);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  listingDate.setHours(0, 0, 0, 0);
  return listingDate.getTime() === today.getTime();
}

function isTomorrowListing(firstOpenTime: number): boolean {
  if (!firstOpenTime) return false;
  const listingDate = new Date(firstOpenTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  listingDate.setHours(0, 0, 0, 0);
  return listingDate.getTime() === tomorrow.getTime();
}

async function checkCalendarAPI() {
  console.log("🔍 Fetching new coin listings from MEXC Calendar API...\n");
  console.log(`📡 API Endpoint: ${CALENDAR_API_URL}\n`);

  try {
    const timestamp = Date.now();
    const url = `${CALENDAR_API_URL}?timestamp=${timestamp}`;

    const response = await axios.get<CalendarResponse>(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.mexc.com/",
        Origin: "https://www.mexc.com",
      },
      timeout: 10_000,
    });

    console.log(`✅ API Response Status: ${response.status}\n`);

    if (!response.data?.data?.newCoins) {
      console.log("⚠️  No newCoins array found in response");
      console.log(
        "Response structure:",
        JSON.stringify(response.data, null, 2).substring(0, 500)
      );
      return;
    }

    const coins = response.data.data.newCoins;
    console.log(`📊 Total coins in calendar: ${coins.length}\n`);

    // Filter today's listings
    const todayListings = coins.filter((coin) => {
      const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
      return firstOpenTime > 0 && isTodayListing(firstOpenTime);
    });

    // Filter tomorrow's listings
    const tomorrowListings = coins.filter((coin) => {
      const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
      return firstOpenTime > 0 && isTomorrowListing(firstOpenTime);
    });

    // Display today's listings
    console.log("=".repeat(70));
    console.log("📅 TODAY'S NEW COINS");
    console.log("=".repeat(70));

    if (todayListings.length === 0) {
      console.log("   No new coins scheduled for today.\n");
    } else {
      todayListings.forEach((coin, index) => {
        const symbol = coin.symbol || `${coin.vcoinName}USDT`;
        const name =
          coin.vcoinNameFull || coin.projectName || coin.vcoinName || symbol;
        const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
        const releaseDate = new Date(firstOpenTime);

        console.log(`\n${index + 1}. ${symbol}`);
        console.log(`   Name: ${name}`);
        console.log(
          `   Release: ${releaseDate.toLocaleDateString()} ${releaseDate.toLocaleTimeString()}`
        );
        if (coin.vcoinId) {
          console.log(`   VCoin ID: ${coin.vcoinId}`);
        }
        if (coin.zone) {
          console.log(`   Zone: ${coin.zone}`);
        }
      });
      console.log(`\n   Total: ${todayListings.length} coin(s)\n`);
    }

    // Display tomorrow's listings
    console.log("=".repeat(70));
    console.log("📅 TOMORROW'S NEW COINS");
    console.log("=".repeat(70));

    if (tomorrowListings.length === 0) {
      console.log("   No new coins scheduled for tomorrow.\n");
    } else {
      tomorrowListings.forEach((coin, index) => {
        const symbol = coin.symbol || `${coin.vcoinName}USDT`;
        const name =
          coin.vcoinNameFull || coin.projectName || coin.vcoinName || symbol;
        const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
        const releaseDate = new Date(firstOpenTime);

        console.log(`\n${index + 1}. ${symbol}`);
        console.log(`   Name: ${name}`);
        console.log(
          `   Release: ${releaseDate.toLocaleDateString()} ${releaseDate.toLocaleTimeString()}`
        );
        if (coin.vcoinId) {
          console.log(`   VCoin ID: ${coin.vcoinId}`);
        }
        if (coin.zone) {
          console.log(`   Zone: ${coin.zone}`);
        }
      });
      console.log(`\n   Total: ${tomorrowListings.length} coin(s)\n`);
    }

    // Summary
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log(`   Today: ${todayListings.length} coin(s)`);
    console.log(`   Tomorrow: ${tomorrowListings.length} coin(s)`);
    console.log(`   Total in calendar: ${coins.length} coin(s)`);
    console.log("");

    // Show upcoming listings (next 7 days)
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const upcomingListings = coins.filter((coin) => {
      const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
      return firstOpenTime > now && firstOpenTime <= sevenDaysFromNow;
    });

    if (
      upcomingListings.length >
      todayListings.length + tomorrowListings.length
    ) {
      console.log("=".repeat(70));
      console.log("📅 UPCOMING (Next 7 Days)");
      console.log("=".repeat(70));
      upcomingListings
        .filter(
          (coin) =>
            !(
              isTodayListing(coin.firstOpenTime || coin.first_open_time || 0) ||
              isTomorrowListing(coin.firstOpenTime || coin.first_open_time || 0)
            )
        )
        .slice(0, 10)
        .forEach((coin, index) => {
          const symbol = coin.symbol || `${coin.vcoinName}USDT`;
          const name =
            coin.vcoinNameFull || coin.projectName || coin.vcoinName || symbol;
          const firstOpenTime = coin.firstOpenTime || coin.first_open_time || 0;
          const releaseDate = new Date(firstOpenTime);

          console.log(`\n${index + 1}. ${symbol} - ${name}`);
          console.log(
            `   Release: ${releaseDate.toLocaleDateString()} ${releaseDate.toLocaleTimeString()}`
          );
        });
      console.log("");
    }
  } catch (error) {
    console.error("❌ Failed to fetch calendar listings:\n");

    if (axios.isAxiosError(error)) {
      console.error(`   Status: ${error.response?.status || "N/A"}`);
      console.error(`   Message: ${error.message}`);

      if (error.response?.data) {
        console.error(
          `   Response: ${JSON.stringify(error.response.data).substring(0, 500)}`
        );
      }

      if (error.code === "ECONNABORTED") {
        console.error("\n   ⚠️  Request timed out after 10 seconds");
      }
    } else if (error instanceof Error) {
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
checkCalendarAPI()
  .then(() => {
    console.log("✨ Done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
