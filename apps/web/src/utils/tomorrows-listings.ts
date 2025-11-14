/**
 * Utility functions for filtering and working with tomorrow's listings
 */

export interface CalendarEntry {
  vcoinId?: string;
  symbol?: string;
  projectName?: string;
  firstOpenTime?: number | string;
  vcoinName?: string;
  vcoinNameFull?: string;
}

/**
 * Check if a listing is from tomorrow
 */
export function isTomorrowListing(listing: CalendarEntry): boolean {
  if (!listing.firstOpenTime) {
    return false;
  }

  const listingDate = new Date(listing.firstOpenTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time to compare dates only
  listingDate.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);

  return listingDate.getTime() === tomorrow.getTime();
}

/**
 * Filter calendar listings to get only tomorrow's listings
 */
export function filterTomorrowsListings(
  listings: CalendarEntry[]
): CalendarEntry[] {
  return listings.filter(isTomorrowListing);
}

/**
 * Get tomorrow's listings from calendar data
 */
export async function getTomorrowsListings(
  getCalendarListings: () => Promise<{
    success: boolean;
    data?: CalendarEntry[];
  }>
): Promise<CalendarEntry[]> {
  try {
    const response = await getCalendarListings();

    if (!(response.success && response.data)) {
      return [];
    }

    return filterTomorrowsListings(response.data);
  } catch (error) {
    console.error("Error fetching tomorrow's listings:", error);
    return [];
  }
}

/**
 * Check if a listing is within the next 48 hours (covers tomorrow + day after)
 */
export function isUpcomingListing(
  listing: CalendarEntry,
  hoursAhead = 48
): boolean {
  if (!listing.firstOpenTime) {
    return false;
  }

  const listingTime = new Date(listing.firstOpenTime).getTime();
  const now = Date.now();
  const futureTime = now + hoursAhead * 60 * 60 * 1000;

  return listingTime > now && listingTime <= futureTime;
}
