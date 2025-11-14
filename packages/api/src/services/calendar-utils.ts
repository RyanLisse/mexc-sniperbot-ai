import type { CalendarEntry } from "./mexc-client";

/**
 * Check if a listing is from today
 */
export function isTodayListing(entry: CalendarEntry): boolean {
  if (!entry.firstOpenTime) {
    return false;
  }

  const listingDate = new Date(entry.firstOpenTime);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  listingDate.setHours(0, 0, 0, 0);

  return listingDate.getTime() === today.getTime();
}

/**
 * Check if a listing is from tomorrow
 */
export function isTomorrowListing(entry: CalendarEntry): boolean {
  if (!entry.firstOpenTime) {
    return false;
  }

  const listingDate = new Date(entry.firstOpenTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  listingDate.setHours(0, 0, 0, 0);

  return listingDate.getTime() === tomorrow.getTime();
}

/**
 * Check if a listing is within the next N hours
 */
export function isUpcomingListing(
  entry: CalendarEntry,
  hoursAhead = 48
): boolean {
  if (!entry.firstOpenTime) {
    return false;
  }

  const now = Date.now();
  const listingTime = entry.firstOpenTime;
  const futureTime = now + hoursAhead * 60 * 60 * 1000; // Convert hours to milliseconds

  return listingTime > now && listingTime <= futureTime;
}

/**
 * Filter calendar listings by time window
 * Returns listings that are:
 * - In the future (not already launched)
 * - Within the specified time window (hours ahead)
 * - Or specifically tomorrow's listings (always included)
 */
export function filterListingsByTimeWindow(
  entries: CalendarEntry[],
  hours: number
): CalendarEntry[] {
  const now = Date.now();
  // Ensure at least 48 hours to cover tomorrow's listings
  const minWindowHours = Math.max(hours, 48);
  const timeWindow = minWindowHours * 60 * 60 * 1000; // Convert to milliseconds

  return entries.filter((entry) => {
    try {
      const launchTime = entry.firstOpenTime;

      // Include launches that are:
      // 1. In the future (not already launched)
      // 2. Within the specified time window (minimum 48h to cover tomorrow)
      const isUpcoming = launchTime > now;
      const isWithinWindow = launchTime < now + timeWindow;

      // Also check if it's specifically tomorrow's listing (always include)
      const isTomorrow = isTomorrowListing(entry);

      return (
        ((isUpcoming && isWithinWindow) || isTomorrow) &&
        entry.vcoinId &&
        entry.vcoinName
      );
    } catch (_error) {
      return false;
    }
  });
}

/**
 * Filter calendar listings to get only today's listings
 */
export function filterTodaysListings(
  listings: CalendarEntry[]
): CalendarEntry[] {
  return listings.filter(isTodayListing);
}

/**
 * Filter calendar listings to get only tomorrow's listings
 */
export function filterTomorrowsListings(
  listings: CalendarEntry[]
): CalendarEntry[] {
  return listings.filter(isTomorrowListing);
}
