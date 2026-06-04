import { format } from 'date-fns';
import { t } from '@/i18n';

export type ScheduledBookingInfo = {
  customerName: string;
  scheduled_at: string;
  party_size: number;
};

export function getTableBookingWarning(booking: ScheduledBookingInfo) {
  return {
    title: t('orders.tableBookedWarningTitle'),
    message: t('orders.tableBookedWarningMessage', {
      name: booking.customerName,
      time: format(new Date(booking.scheduled_at), 'dd.MM.yyyy HH:mm'),
      n: booking.party_size,
    }),
  };
}
