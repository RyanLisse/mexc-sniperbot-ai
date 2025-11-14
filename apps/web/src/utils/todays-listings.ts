/**
 * Utility functions for filtering and working with today's listings
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
 * Check if a listing is from today
 */
export function isTodayListing(listing: CalendarEntry): boolean {
  if (!listing.firstOpenTime) {
    return false;
  }

  const listingDate = new Date(listing.firstOpenTime);
  const today = new Date();

  // Reset time to compare dates only
  listingDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return listingDate.getTime() === today.getTime();
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
 * Get today's listings from calendar data
 */
export async function getTodaysListings(
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

    return filterTodaysListings(response.data);
  } catch (error) {
    console.error("Error fetching today's listings:", error);
    return [];
  }
}
