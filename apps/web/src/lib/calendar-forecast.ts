import type { CoinForecast } from "@mexc-sniperbot-ai/api";

type RawCalendarEntry = {
  symbol?: string;
  vcoinName?: string;
  vcoinNameFull?: string;
  firstOpenTime?: number;
};

const HOURS_IN_DAY = 24;
const MILLIS_IN_HOUR = 60 * 60 * 1000;
const FORECAST_WINDOW_HOURS = 168; // 7 days

function isValidTimestamp(value?: number): value is number {
  if (!value || value <= 0) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target.getTime() === today.getTime();
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target.getTime() === tomorrow.getTime();
}

export function buildCoinForecasts(entries: RawCalendarEntry[]): {
  today: CoinForecast[];
  tomorrow: CoinForecast[];
  all: CoinForecast[];
} {
  const now = Date.now();
  const maxWindow = now + FORECAST_WINDOW_HOURS * MILLIS_IN_HOUR;

  const forecasts: CoinForecast[] = entries
    .filter((entry) => entry.symbol && isValidTimestamp(entry.firstOpenTime))
    .map((entry) => {
      const symbol = entry.symbol as string;
      const projectName = entry.vcoinNameFull || entry.vcoinName || "";
      const releaseDate = new Date(entry.firstOpenTime as number);

      if (
        releaseDate.getTime() < now - HOURS_IN_DAY * MILLIS_IN_HOUR ||
        releaseDate.getTime() > maxWindow
      ) {
        return;
      }

      let potential = 3;
      if (projectName.length > 10) {
        potential = 4;
      }
      if (symbol.includes("AI") || symbol.includes("GPT")) {
        potential = 5;
      } else if (symbol.length < 6) {
        potential = 4;
      }

      const baseForecast = Math.random() * 30 - 5;
      const forecast = Math.round(baseForecast * 100) / 100;

      return {
        symbol,
        name: projectName || symbol.replace("USDT", ""),
        releaseDate,
        potential,
        forecast,
      } satisfies CoinForecast;
    })
    .filter((entry): entry is CoinForecast => Boolean(entry));

  const today = forecasts.filter((forecast) => isToday(forecast.releaseDate));
  const tomorrow = forecasts.filter((forecast) =>
    isTomorrow(forecast.releaseDate)
  );

  return {
    today,
    tomorrow,
    all: forecasts,
  };
}
