import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestaurantId, useAuth } from '@/contexts/AuthContext';
import { isCashier, isManager, isWaiter } from '@/lib/roles';
import { fetchMyStaffId } from '@/lib/staffInvite';
import {
  validateOrderStock,
  deductOrderStock,
  restoreOrderStock,
  updateTableStatus,
  type StockFailure,
} from '@/lib/stock';
import { canEditOrderItems, orderStockWasDeducted } from '@/lib/orderEdit';
import { assertTableAvailableForNewOrder } from '@/lib/tableOrder';
import {
  buildOrderItemSaveOps,
  stockDeltasFromOps,
  stockFailureError,
  validateOrderItemEditsForWaiter,
  type DraftOrderLine,
} from '@/lib/orderItemSave';
import type { OrderStatus } from '@/types';

function invalidateOrderQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['orders'] });
  void qc.invalidateQueries({ queryKey: ['order'] });
  void qc.invalidateQueries({ queryKey: ['kitchen-queue'] });
  void qc.invalidateQueries({ queryKey: ['tables-with-waiters'] });
  void qc.invalidateQueries({ queryKey: ['tables'] });
  void qc.invalidateQueries({ queryKey: ['table-ids-open-orders'] });
  void qc.invalidateQueries({ queryKey: ['open-orders-count'] });
  void qc.invalidateQueries({ queryKey: ['products'] });
  void qc.invalidateQueries({ queryKey: ['inventory_items'] });
  void qc.invalidateQueries({ queryKey: ['warehouse-product-ids'] });
  void qc.invalidateQueries({ queryKey: ['stock-alerts'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
}

async function markOrderStockDeducted(orderId: string) {
  const { error } = await supabase.from('orders').update({ stock_deducted: true }).eq('id', orderId);
  if (error) throw error;
}

async function deductOrderLines(lines: { product_id: string; quantity: number }[]) {
  if (lines.length === 0) return;
  const failures = await validateOrderStock(lines);
  if (failures.length > 0) {
    const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
    err.stockFailures = failures;
    throw err;
  }
  await deductOrderStock(lines);
}

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
        .limit(200);

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

      if (body.table_id) {
        await assertTableAvailableForNewOrder(body.table_id);
      }

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

async function fetchOrderForEdit(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, sent_to_kitchen_at, stock_deducted')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  if (!canEditOrderItems(data.status as OrderStatus)) {
    throw new Error('ORDER_NOT_EDITABLE');
  }
  return data;
}

async function applyStockDelta(
  productId: string,
  delta: number,
  stockDeducted: boolean,
): Promise<StockFailure[] | null> {
  if (delta === 0 || !stockDeducted) return null;
  if (delta > 0) {
    const failures = await validateOrderStock([{ product_id: productId, quantity: delta }]);
    if (failures.length > 0) return failures;
    await deductOrderStock([{ product_id: productId, quantity: delta }]);
    return null;
  }
  await restoreOrderStock([{ product_id: productId, quantity: -delta }]);
  return null;
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
      const order = await fetchOrderForEdit(orderId);
      const stockDeducted = orderStockWasDeducted(order);

      const { data: existing } = await supabase
        .from('order_items')
        .select('id, quantity')
        .eq('order_id', orderId)
        .eq('product_id', productId)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const nextQty = existing.quantity + quantity;
        const failures = await applyStockDelta(productId, quantity, stockDeducted);
        if (failures?.length) {
          const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
          err.stockFailures = failures;
          throw err;
        }
        const { error } = await supabase
          .from('order_items')
          .update({ quantity: nextQty })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const failures = await applyStockDelta(productId, quantity, stockDeducted);
      if (failures?.length) {
        const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
        err.stockFailures = failures;
        throw err;
      }

      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('price, tax_rate, name')
        .eq('id', productId)
        .single();
      if (pErr) throw pErr;

      const { error } = await supabase.from('order_items').insert({
        restaurant_id: restaurantId!,
        order_id: orderId,
        product_id: productId,
        product_name: product.name,
        quantity,
        unit_price: product.price,
        tax_rate: product.tax_rate,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateOrderQueries(qc),
  });
}

export function useUpdateOrderItemQuantity() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      quantity,
    }: {
      orderId: string;
      itemId: string;
      quantity: number;
    }) => {
      const order = await fetchOrderForEdit(orderId);
      const stockDeducted = orderStockWasDeducted(order);

      const { data: item, error: iErr } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, kitchen_qty')
        .eq('id', itemId)
        .eq('order_id', orderId)
        .single();
      if (iErr) throw iErr;

      if (profile?.role && !isManager(profile.role)) {
        if (quantity !== item.quantity) throw new Error('ITEM_IN_KITCHEN');
      }

      if (quantity <= 0) {
        if (stockDeducted && item.product_id) {
          await restoreOrderStock([{ product_id: item.product_id, quantity: item.quantity }]);
        }
        const { error } = await supabase.from('order_items').delete().eq('id', itemId);
        if (error) throw error;
        return;
      }

      const delta = quantity - item.quantity;
      if (item.product_id) {
        const failures = await applyStockDelta(item.product_id, delta, stockDeducted);
        if (failures?.length) {
          const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
          err.stockFailures = failures;
          throw err;
        }
      }

      const { error } = await supabase.from('order_items').update({ quantity }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => invalidateOrderQueries(qc),
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
  const restaurantId = useRestaurantId();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('send_order_to_kitchen', { p_order_id: orderId });
      if (error) throw error;

      const result = data as { ok?: boolean; failures?: StockFailure[] } | null;
      if (result?.ok === false) {
        const failures = result.failures ?? [];
        if (failures.length > 0) throw stockFailureError(failures);
        throw new Error('INSUFFICIENT_STOCK');
      }

      return orderId;
    },
    onMutate: async (orderId) => {
      const ordersKey = ['orders', restaurantId, undefined] as const;
      await qc.cancelQueries({ queryKey: ['orders', restaurantId] });
      const snapshot = qc.getQueryData(ordersKey);
      const now = new Date().toISOString();

      qc.setQueryData(ordersKey, (old: { id: string; status: OrderStatus; sent_to_kitchen_at?: string | null; stock_deducted?: boolean }[] | undefined) =>
        old?.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'NEW',
                sent_to_kitchen_at: o.sent_to_kitchen_at ?? now,
                stock_deducted: true,
              }
            : o,
        ),
      );

      return { snapshot, ordersKey };
    },
    onError: (_err, _orderId, context) => {
      if (context?.snapshot !== undefined) {
        qc.setQueryData(context.ordersKey, context.snapshot);
      }
    },
    onSuccess: (orderId) => {
      void qc.invalidateQueries({ queryKey: ['orders', restaurantId] });
      void qc.invalidateQueries({ queryKey: ['kitchen-queue', restaurantId] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

export function useSaveOrderItems() {
  const restaurantId = useRestaurantId();
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      original,
      draft,
    }: {
      orderId: string;
      original: DraftOrderLine[];
      draft: DraftOrderLine[];
    }) => {
      if (profile?.role && !isManager(profile.role) && !validateOrderItemEditsForWaiter(original, draft)) {
        throw new Error('ITEM_IN_KITCHEN');
      }

      const ops = buildOrderItemSaveOps(original, draft);
      if (profile?.role && !isManager(profile.role) && ops.some((op) => op.type !== 'insert')) {
        throw new Error('ITEM_IN_KITCHEN');
      }

      const order = await fetchOrderForEdit(orderId);
      const stockDeducted = orderStockWasDeducted(order);
      if (ops.length === 0) return;

      if (stockDeducted) {
        const deltas = stockDeltasFromOps(ops);
        const toDeduct = deltas.filter((d) => d.delta > 0).map((d) => ({
          product_id: d.product_id,
          quantity: d.delta,
        }));
        const toRestore = deltas
          .filter((d) => d.delta < 0)
          .map((d) => ({ product_id: d.product_id, quantity: -d.delta }));

        if (toDeduct.length > 0) {
          const failures = await validateOrderStock(toDeduct);
          if (failures.length > 0) throw stockFailureError(failures);
          await deductOrderStock(toDeduct);
        }
        if (toRestore.length > 0) await restoreOrderStock(toRestore);
      }

      for (const op of ops) {
        if (op.type === 'delete') {
          const { error } = await supabase.from('order_items').delete().eq('id', op.itemId);
          if (error) throw error;
          continue;
        }
        if (op.type === 'update') {
          if (op.toQty <= 0) {
            const { error } = await supabase.from('order_items').delete().eq('id', op.itemId);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('order_items')
              .update({ quantity: op.toQty })
              .eq('id', op.itemId);
            if (error) throw error;
          }
          continue;
        }
        if (op.type === 'insert') {
          const { data: existing } = await supabase
            .from('order_items')
            .select('id, quantity')
            .eq('order_id', orderId)
            .eq('product_id', op.productId)
            .limit(1)
            .maybeSingle();

          if (existing && profile?.role && isManager(profile.role)) {
            const { error } = await supabase
              .from('order_items')
              .update({ quantity: existing.quantity + op.quantity })
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('order_items').insert({
              restaurant_id: restaurantId!,
              order_id: orderId,
              product_id: op.productId,
              product_name: op.product_name,
              quantity: op.quantity,
              unit_price: op.unit_price,
              tax_rate: op.tax_rate,
            });
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: (_, { orderId }) => {
      invalidateOrderQueries(qc);
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

export function useRemoveOrderItem() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, orderId }: { itemId: string; orderId: string }) => {
      const order = await fetchOrderForEdit(orderId);
      const stockDeducted = orderStockWasDeducted(order);

      const { data: item, error: iErr } = await supabase
        .from('order_items')
        .select('product_id, quantity, kitchen_qty')
        .eq('id', itemId)
        .single();
      if (iErr) throw iErr;

      if (profile?.role && !isManager(profile.role)) {
        throw new Error('ITEM_IN_KITCHEN');
      }

      if (stockDeducted && item.product_id) {
        await restoreOrderStock([{ product_id: item.product_id, quantity: item.quantity }]);
      }

      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => invalidateOrderQueries(qc),
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
      if (profile?.role && isCashier(profile.role)) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: session, error: sessionErr } = await supabase
          .from('cash_register_sessions')
          .select('opened_by_profile_id, opened_by_staff_id, status')
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'OPEN')
          .maybeSingle();
        if (sessionErr) throw sessionErr;
        if (session) {
          let myStaffId: string | null = null;
          if (session.opened_by_staff_id) {
            myStaffId = await fetchMyStaffId();
          }
          const isOwner =
            (session.opened_by_profile_id && session.opened_by_profile_id === user?.id) ||
            (session.opened_by_staff_id && myStaffId && session.opened_by_staff_id === myStaffId);
          if (!isOwner) throw new Error('CASH_REGISTER_OPENED_BY_ANOTHER_CASHIER');
        }
      }

      let staffId = body.staff_id ?? null;
      if (!staffId && profile?.role && isWaiter(profile.role)) {
        staffId = await fetchMyStaffId();
      }

      const stockLines = body.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      if (stockLines.length > 0) {
        const failures = await validateOrderStock(stockLines);
        if (failures.length > 0) {
          const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
          err.stockFailures = failures;
          throw err;
        }
      }

      const { data: orderNum, error: numErr } = await supabase.rpc('next_order_number', {
        p_restaurant_id: restaurantId!,
      });
      if (numErr) throw numErr;

      if (body.table_id) {
        await assertTableAvailableForNewOrder(body.table_id);
      }

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

      for (const line of body.items) {
        const { data: product, error: pErr } = await supabase
          .from('products')
          .select('price, tax_rate, name')
          .eq('id', line.product_id)
          .single();
        if (pErr) throw pErr;

        const { error: iErr } = await supabase.from('order_items').insert({
          restaurant_id: restaurantId!,
          order_id: order.id,
          product_id: line.product_id,
          product_name: product.name,
          quantity: line.quantity,
          kitchen_qty: body.sendToKitchen ? line.quantity : 0,
          unit_price: product.price,
          tax_rate: product.tax_rate,
        });
        if (iErr) throw iErr;
      }

      await deductOrderLines(stockLines);
      await markOrderStockDeducted(order.id);

      const { data: full, error: fErr } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('id', order.id)
        .single();
      if (fErr) throw fErr;
      return full;
    },
    onSuccess: () => invalidateOrderQueries(qc),
  });
}

export function useCloseOrder() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      payments,
      tableId,
      cashRegisterSessionId,
    }: {
      orderId: string;
      amount: number;
      payments?: { method: string; amount: number }[];
      tableId?: string | null;
      cashRegisterSessionId?: string | null;
    }) => {
      const lines =
        payments && payments.length > 0
          ? payments
          : [{ method: 'CASH', amount }];

      const sum = lines.reduce((s, l) => s + Number(l.amount), 0);
      if (Math.abs(sum - amount) > 0.01) {
        throw new Error('PAYMENT_TOTAL_MISMATCH');
      }

      if (cashRegisterSessionId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: session, error: sessionErr } = await supabase
          .from('cash_register_sessions')
          .select('id, status, opened_by_profile_id, opened_by_staff_id')
          .eq('id', cashRegisterSessionId)
          .eq('restaurant_id', restaurantId!)
          .maybeSingle();
        if (sessionErr) throw sessionErr;
        if (!session || session.status !== 'OPEN') throw new Error('CASH_REGISTER_NOT_OPEN');

        let staffId: string | null = null;
        if (session.opened_by_staff_id) {
          staffId = await fetchMyStaffId();
        }
        const isOwner =
          (session.opened_by_profile_id && session.opened_by_profile_id === user?.id) ||
          (session.opened_by_staff_id && staffId && session.opened_by_staff_id === staffId);
        if (!isOwner) throw new Error('CASH_REGISTER_OPENED_BY_ANOTHER_CASHIER');
      }

      for (const line of lines) {
        const { error: payErr } = await supabase.from('payments').insert({
          restaurant_id: restaurantId!,
          order_id: orderId,
          amount: line.amount,
          method: line.method,
          status: 'COMPLETED',
          cash_register_session_id: cashRegisterSessionId ?? null,
        });
        if (payErr) throw payErr;
      }

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
      qc.invalidateQueries({ queryKey: ['incomes'] });
      qc.invalidateQueries({ queryKey: ['cash-register-session-totals'] });
      qc.invalidateQueries({ queryKey: ['cash-register-open'] });
    },
  });
}
