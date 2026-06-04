import { format } from 'date-fns';
import { t } from '@/i18n';

/** Booking time has arrived — staff should call the client. */
export function isBookingArrivalDue(scheduled_at: string, now = Date.now()): boolean {
  const at = new Date(scheduled_at).getTime();
  if (Number.isNaN(at)) return false;
  return now >= at;
}

export function formatBookingArrivalTime(scheduled_at: string): string {
  return format(new Date(scheduled_at), 'dd.MM.yyyy HH:mm');
}

export function bookingArrivalNotifyPayload(booking: {
  tableName: string;
  customerName: string;
  customerPhone: string | null;
  scheduled_at: string;
}) {
  const time = formatBookingArrivalTime(booking.scheduled_at);
  const phoneBit = booking.customerPhone ? ` · ${booking.customerPhone}` : '';
  return {
    title: t('bookings.arrivalCallTitle'),
    message: t('bookings.arrivalCallMessage', {
      table: booking.tableName,
      name: booking.customerName,
      time,
      phone: phoneBit,
    }),
  };
}
