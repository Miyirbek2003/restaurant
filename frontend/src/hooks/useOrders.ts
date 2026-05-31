import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestaurantId, useAuth } from '@/contexts/AuthContext';
import { isWaiter } from '@/lib/roles';
import { fetchMyStaffId } from '@/lib/staffInvite';
import {
  validateOrderStock,
  deductOrderStock,
  updateTableStatus,
  type StockFailure,
} from '@/lib/stock';
import type { OrderStatus } from '@/types';

const orderSelect = `
  *,
  tables(name),
  staff:restaurant_staff(name, role),
  order_items(*, products(name))
`;

export function useOrders(status?: OrderStatus) {
  const restaurantId = useRestaurantId();

  const query = useQuery({
    queryKey: ['orders', restaurantId, status],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select(orderSelect)
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (status) q = q.eq('status', status);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useRealtimeOrders(restaurantId, () => query.refetch());

  return query;
}

export function useKitchenQueue() {
  const restaurantId = useRestaurantId();

  const query = useQuery({
    queryKey: ['kitchen-queue', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('restaurant_id', restaurantId!)
        .in('status', ['NEW', 'PREPARING', 'READY'])
        .order('sent_to_kitchen_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useRealtimeOrders(restaurantId, () => query.refetch());

  return query;
}

function useRealtimeOrders(restaurantId: string | null, onUpdate: () => void) {
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        onUpdate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `restaurant_id=eq.${restaurantId}` },
        onUpdate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, onUpdate]);
}

export function useCreateOrder() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: { table_id?: string; notes?: string; staff_id?: string }) => {
      const { data: orderNum, error: numErr } = await supabase.rpc('next_order_number', {
        p_restaurant_id: restaurantId!,
      });
      if (numErr) throw numErr;

      const { data, error } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId!,
          staff_id: body.staff_id ?? null,
          order_number: orderNum,
          table_id: body.table_id ?? null,
          notes: body.notes ?? null,
          status: 'DRAFT',
        })
        .select(orderSelect)
        .single();

      if (error) throw error;

      if (body.table_id) {
        await updateTableStatus(body.table_id, 'OCCUPIED');
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
    },
  });
}

export function useAddOrderItem() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      productId,
      quantity,
    }: {
      orderId: string;
      productId: string;
      quantity: number;
    }) => {
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('price, tax_rate')
        .eq('id', productId)
        .single();
      if (pErr) throw pErr;

      const { error } = await supabase.from('order_items').insert({
        restaurant_id: restaurantId!,
        order_id: orderId,
        product_id: productId,
        quantity,
        unit_price: product.price,
        tax_rate: product.tax_rate,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'NEW') updates.sent_to_kitchen_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select(orderSelect)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-queue'] });
    },
  });
}

export function useSendToKitchen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'NEW', sent_to_kitchen_at: new Date().toISOString() })
        .eq('id', orderId)
        .select(orderSelect)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-queue'] });
    },
  });
}

export function useRemoveOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useOrder(orderId: string | undefined) {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ['order', orderId],
    enabled: !!orderId && !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Create order and line items in one flow (waiter POS form) */
export function useCreateOrderWithItems() {
  const restaurantId = useRestaurantId();
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      table_id?: string;
      staff_id?: string;
      notes?: string;
      items: { product_id: string; quantity: number }[];
      sendToKitchen?: boolean;
    }) => {
      let staffId = body.staff_id ?? null;
      if (!staffId && profile?.role && isWaiter(profile.role)) {
        staffId = await fetchMyStaffId();
      }

      const stockLines = body.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      const failures = await validateOrderStock(stockLines);
      if (failures.length > 0) {
        const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
        err.stockFailures = failures;
        throw err;
      }

      const { data: orderNum, error: numErr } = await supabase.rpc('next_order_number', {
        p_restaurant_id: restaurantId!,
      });
      if (numErr) throw numErr;

      const status = body.sendToKitchen ? 'NEW' : 'DRAFT';

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId!,
          staff_id: staffId,
          order_number: orderNum,
          table_id: body.table_id || null,
          notes: body.notes || null,
          status,
          sent_to_kitchen_at: body.sendToKitchen ? new Date().toISOString() : null,
        })
        .select('id')
        .single();
      if (oErr) throw oErr;

      if (body.table_id) {
        await updateTableStatus(body.table_id, 'OCCUPIED');
      }

      if (body.sendToKitchen) {
        await deductOrderStock(stockLines);
      }

      for (const line of body.items) {
        const { data: product, error: pErr } = await supabase
          .from('products')
          .select('price, tax_rate')
          .eq('id', line.product_id)
          .single();
        if (pErr) throw pErr;

        const { error: iErr } = await supabase.from('order_items').insert({
          restaurant_id: restaurantId!,
          order_id: order.id,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: product.price,
          tax_rate: product.tax_rate,
        });
        if (iErr) throw iErr;
      }

      const { data: full, error: fErr } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('id', order.id)
        .single();
      if (fErr) throw fErr;
      return full;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
      qc.invalidateQueries({ queryKey: ['kitchen-queue'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock-alerts'] });
    },
  });
}

export function useCloseOrder() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      method = 'CASH',
      tableId,
    }: {
      orderId: string;
      amount: number;
      method?: string;
      tableId?: string | null;
    }) => {
      const { error: payErr } = await supabase.from('payments').insert({
        restaurant_id: restaurantId!,
        order_id: orderId,
        amount,
        method,
        status: 'COMPLETED',
      });
      if (payErr) throw payErr;

      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', orderId)
        .select(orderSelect)
        .single();
      if (error) throw error;

      if (tableId) {
        await updateTableStatus(tableId, 'FREE');
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['waiter-paid-orders'] });
    },
  });
}
