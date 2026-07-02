import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { OPEN_ORDER_STATUSES } from '@/lib/tableOrder';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
export type TableChargeType = 'NONE' | 'HOURLY' | 'ONE_TIME';

export function useTables() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tables', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`tables:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` },
        () => void qc.invalidateQueries({ queryKey: ['tables', restaurantId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  return query;
}

/** Tables with active order + waiter name for floor view */
export function useTablesWithWaiters() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['tables-with-waiters', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data: tables, error: tErr } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (tErr) throw tErr;

      const { data: openOrders, error: oErr } = await supabase
        .from('orders')
        .select('id, table_id, staff_id, status')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED']);
      if (oErr) throw oErr;

      const staffIds = [
        ...new Set((openOrders ?? []).map((o) => o.staff_id).filter((id): id is string => Boolean(id))),
      ];
      let staffNames: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: staffRows, error: wErr } = await supabase
          .from('restaurant_staff')
          .select('id, name')
          .in('id', staffIds);
        if (wErr) throw wErr;
        staffNames = Object.fromEntries((staffRows ?? []).map((w) => [w.id, w.name]));
      }

      return (tables ?? []).map((table) => {
        const order = (openOrders ?? []).find((o) => o.table_id === table.id);
        const waiterName = order?.staff_id ? staffNames[order.staff_id] ?? null : null;
        return { ...table, waiterName, openOrderId: order?.id ?? null };
      });
    },
  });
}

/** Table IDs that already have an open order (status not paid/cancelled). */
export function useTableIdsWithOpenOrders() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['table-ids-open-orders', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('table_id')
        .eq('restaurant_id', restaurantId!)
        .in('status', [...OPEN_ORDER_STATUSES])
        .not('table_id', 'is', null);
      if (error) throw error;
      return new Set((data ?? []).map((o) => o.table_id as string));
    },
  });
}

export function useCreateTable() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      capacity: number;
      floor?: string;
      charge_type?: TableChargeType;
      charge_amount?: number;
    }) => {
      if (!restaurantId) throw new Error('No restaurant assigned');
      const { data, error } = await supabase
        .from('tables')
        .insert({ ...body, restaurant_id: restaurantId, status: 'FREE' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      capacity?: number;
      floor?: string;
      status?: TableStatus;
      charge_type?: TableChargeType;
      charge_amount?: number;
    }) => {
      const { data, error } = await supabase.from('tables').update(body).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tables'] });
      void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}
