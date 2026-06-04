import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { bookingRangeForView, type BookingListView } from '@/lib/bookingRange';

export type BookingStatus = 'SCHEDULED' | 'ARRIVED' | 'CANCELLED' | 'NO_SHOW';

export type TableBookingRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  customer_id: string;
  scheduled_at: string;
  party_size: number;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  tables: { name: string; floor: string | null; capacity: number } | null;
  customers: { name: string; phone: string | null } | null;
};

export type CreateBookingInput = {
  table_id: string;
  customer_id: string;
  scheduled_at: string;
  party_size: number;
  notes?: string | null;
};

export function useTableBookings(view: BookingListView = 'upcoming') {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['table-bookings', restaurantId, view],
    enabled: Boolean(restaurantId),
    retry: 1,
    queryFn: async (): Promise<TableBookingRow[]> => {
      const { fromIso, toIso } = bookingRangeForView(view);
      let q = supabase
        .from('table_bookings')
        .select(
          'id, restaurant_id, table_id, customer_id, scheduled_at, party_size, notes, status, created_at, tables(name, floor, capacity), customers(name, phone)',
        )
        .eq('restaurant_id', restaurantId!)
        .order('scheduled_at', { ascending: true });

      if (fromIso) q = q.gte('scheduled_at', fromIso);
      if (toIso) q = q.lte('scheduled_at', toIso);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((row) => {
        const tables = row.tables as { name: string; floor: string | null; capacity: number } | { name: string; floor: string | null; capacity: number }[] | null;
        const customers = row.customers as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
        return {
          ...row,
          tables: Array.isArray(tables) ? tables[0] ?? null : tables,
          customers: Array.isArray(customers) ? customers[0] ?? null : customers,
        } as TableBookingRow;
      });
    },
  });
}

/** Next scheduled booking per table (for floor cards). */
export function useScheduledBookingsByTable() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['table-bookings-by-table', restaurantId],
    enabled: Boolean(restaurantId),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_bookings')
        .select('id, table_id, scheduled_at, party_size, customers(name, phone)')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'SCHEDULED')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const map = new Map<
        string,
        {
          id: string;
          scheduled_at: string;
          party_size: number;
          customerName: string;
          customerPhone: string | null;
        }
      >();

      for (const row of data ?? []) {
        if (map.has(row.table_id)) continue;
        const raw = row.customers as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
        const customer = Array.isArray(raw) ? raw[0] ?? null : raw;
        map.set(row.table_id, {
          id: row.id,
          scheduled_at: row.scheduled_at,
          party_size: row.party_size,
          customerName: customer?.name ?? '—',
          customerPhone: customer?.phone ?? null,
        });
      }

      return map;
    },
  });
}

export function useCreateTableBooking() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateBookingInput) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('table_bookings')
        .insert({
          restaurant_id: restaurantId,
          table_id: body.table_id,
          customer_id: body.customer_id,
          scheduled_at: body.scheduled_at,
          party_size: body.party_size,
          notes: body.notes?.trim() || null,
          status: 'SCHEDULED',
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['table-bookings'] });
      void qc.invalidateQueries({ queryKey: ['table-bookings-by-table'] });
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}

export function useUpdateTableBookingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { data, error } = await supabase
        .from('table_bookings')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['table-bookings'] });
      void qc.invalidateQueries({ queryKey: ['table-bookings-by-table'] });
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}

export function useUpdateTableBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      table_id?: string;
      customer_id?: string;
      scheduled_at?: string;
      party_size?: number;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('table_bookings')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['table-bookings'] });
      void qc.invalidateQueries({ queryKey: ['table-bookings-by-table'] });
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}
