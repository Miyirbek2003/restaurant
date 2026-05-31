import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type PaidOrderRow = {
  id: string;
  order_number: number;
  total: number;
  paid_at: string | null;
  table_id: string | null;
  staff_id: string | null;
  tables: { name: string } | null;
  staff: { id: string; name: string } | null;
};

export type WaiterSalesSummary = {
  staffId: string;
  staffName: string;
  paidOrderCount: number;
  totalRevenue: number;
  orders: Array<{
    id: string;
    orderNumber: number;
    tableName: string;
    total: number;
    paidAt: string | null;
  }>;
};

export function useWaiterPaidOrders() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['waiter-paid-orders', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, order_number, total, paid_at, table_id, staff_id, tables(name), staff:restaurant_staff(id, name)',
        )
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'PAID')
        .not('staff_id', 'is', null)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizePaidOrderRow);
    },
  });
}

function pickName<T extends { name: string }>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function normalizePaidOrderRow(row: Record<string, unknown>): PaidOrderRow {
  return {
    id: row.id as string,
    order_number: row.order_number as number,
    total: row.total as number,
    paid_at: row.paid_at as string | null,
    table_id: row.table_id as string | null,
    staff_id: row.staff_id as string | null,
    tables: pickName(row.tables as { name: string } | { name: string }[] | null),
    staff: pickName(row.staff as { id: string; name: string } | { id: string; name: string }[] | null),
  };
}

export function summarizeWaiterSales(rows: PaidOrderRow[]): WaiterSalesSummary[] {
  const byStaff = new Map<string, WaiterSalesSummary>();

  for (const row of rows) {
    const staff = row.staff;
    if (!staff?.id) continue;

    let entry = byStaff.get(staff.id);
    if (!entry) {
      entry = {
        staffId: staff.id,
        staffName: staff.name,
        paidOrderCount: 0,
        totalRevenue: 0,
        orders: [],
      };
      byStaff.set(staff.id, entry);
    }

    entry.paidOrderCount += 1;
    entry.totalRevenue += Number(row.total);
    entry.orders.push({
      id: row.id,
      orderNumber: row.order_number,
      tableName: row.tables?.name ?? 'Takeaway',
      total: Number(row.total),
      paidAt: row.paid_at,
    });
  }

  return [...byStaff.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);
}
