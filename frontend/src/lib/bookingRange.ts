import { todayRange } from '@/lib/filters';

export type BookingListView = 'upcoming' | 'today' | 'all';

/** Stable date bounds for booking queries (do not use raw Date.now() in query keys). */
export function bookingRangeForView(view: BookingListView): { fromIso?: string; toIso?: string } {
  if (view === 'all') return {};

  if (view === 'today') {
    const today = todayRange();
    return {
      fromIso: `${today.from}T00:00:00.000Z`,
      toIso: `${today.to}T23:59:59.999Z`,
    };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  end.setHours(23, 59, 59, 999);

  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}
