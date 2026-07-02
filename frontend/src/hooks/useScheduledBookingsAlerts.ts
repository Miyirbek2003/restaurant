import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type ScheduledBookingAlertRow = {
  id: string;
  table_id: string;
  tableName: string;
  scheduled_at: string;
  party_size: number;
  customerName: string;
  customerPhone: string | null;
};

export function useScheduledBookingsAlerts(enabled = true) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['table-bookings-scheduled-alerts', restaurantId],
    enabled: Boolean(restaurantId) && enabled,
    retry: 1,
    refetchInterval: enabled ? 15_000 : false,
    refetchOnWindowFocus: enabled,
    queryFn: async (): Promise<ScheduledBookingAlertRow[]> => {
      const { data, error } = await supabase
        .from('table_bookings')
        .select('id, table_id, scheduled_at, party_size, customers(name, phone), tables(name)')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'SCHEDULED')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const raw = row.customers as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
        const customer = Array.isArray(raw) ? raw[0] ?? null : raw;
        const tables = row.tables as { name: string } | { name: string }[] | null;
        const table = Array.isArray(tables) ? tables[0] ?? null : tables;

        return {
          id: row.id,
          table_id: row.table_id,
          tableName: table?.name ?? '—',
          scheduled_at: row.scheduled_at,
          party_size: row.party_size,
          customerName: customer?.name ?? '—',
          customerPhone: customer?.phone ?? null,
        };
      });
    },
  });
}
