import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantId } from '@/contexts/AuthContext';
import { useScheduledBookingsAlerts, type ScheduledBookingAlertRow } from '@/hooks/useScheduledBookingsAlerts';
import { useNotificationStore } from '@/stores/notificationStore';
import { bookingArrivalNotifyPayload, isBookingArrivalDue } from '@/lib/bookingArrival';
import { canCreateOrders } from '@/lib/roles';

function bookingArrivalDedupeKey(booking: ScheduledBookingAlertRow): string {
  return `booking-arrival:${booking.id}:${booking.scheduled_at}`;
}

/** True when we should poll frequently (booking within 2h ahead or up to 6h overdue). */
function shouldWatchBookings(bookings: ScheduledBookingAlertRow[]): boolean {
  const now = Date.now();
  const ahead = 2 * 60 * 60 * 1000;
  const behind = 6 * 60 * 60 * 1000;
  return bookings.some((b) => {
    const at = new Date(b.scheduled_at).getTime();
    if (Number.isNaN(at)) return false;
    return at <= now + ahead && at >= now - behind;
  });
}

/** Toast + inbox when a scheduled booking time is reached — remind staff to call the client. */
export function useBookingArrivalAlerts() {
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const notify = useNotificationStore((s) => s.add);
  const enabled = Boolean(restaurantId && canCreateOrders(profile?.role));
  const { data: bookings = [], isSuccess } = useScheduledBookingsAlerts(enabled);
  const [tick, setTick] = useState(0);

  const watch = enabled && bookings.length > 0 && shouldWatchBookings(bookings);

  const checkDue = useCallback(() => {
    if (!enabled || !isSuccess) return;

    const now = Date.now();
    for (const booking of bookings) {
      if (!isBookingArrivalDue(booking.scheduled_at, now)) continue;

      const payload = bookingArrivalNotifyPayload(booking);
      notify({
        type: 'warning',
        title: payload.title,
        message: payload.message,
        saveInbox: true,
        dedupeKey: bookingArrivalDedupeKey(booking),
      });
    }
  }, [enabled, isSuccess, bookings, notify]);

  useEffect(() => {
    try {
      sessionStorage.removeItem('booking-arrival-notified');
    } catch {
      /* legacy dedupe key */
    }
  }, []);

  useEffect(() => {
    if (!watch) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, [watch]);

  useEffect(() => {
    checkDue();
  }, [checkDue, tick]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => checkDue();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, checkDue]);
}
