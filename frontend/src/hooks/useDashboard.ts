import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';

export interface DashboardData {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  expensesMonth: number;
  profitMonth: number;
  openOrders: number;
  occupiedTables: number;
  totalTables: number;
  ordersToday: number;
  bestSellers: Array<{ name: string; quantity: number }>;
}

export function useDashboard() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['dashboard', restaurantId],
    enabled: !!restaurantId,
    queryFn: async (): Promise<DashboardData> => {
      const now = new Date();
      const today = startOfDay(now).toISOString();
      const week = startOfWeek(now).toISOString();
      const month = startOfMonth(now).toISOString();

      const [
        paymentsToday,
        paymentsWeek,
        paymentsMonth,
        expensesRes,
        openOrdersRes,
        tablesRes,
        ordersTodayRes,
        orderItemsRes,
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount')
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'COMPLETED')
          .gte('created_at', today),
        supabase
          .from('payments')
          .select('amount')
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'COMPLETED')
          .gte('created_at', week),
        supabase
          .from('payments')
          .select('amount')
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'COMPLETED')
          .gte('created_at', month),
        supabase
          .from('expenses')
          .select('amount')
          .eq('restaurant_id', restaurantId!)
          .gte('date', month.slice(0, 10)),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId!)
          .in('status', ['DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED']),
        supabase.from('tables').select('status').eq('restaurant_id', restaurantId!),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'PAID')
          .gte('paid_at', today),
        supabase
          .from('order_items')
          .select('quantity, product_name, products(name)')
          .eq('restaurant_id', restaurantId!)
          .limit(500),
      ]);

      const sum = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((a, r) => a + Number(r.amount), 0);

      const tables = tablesRes.data ?? [];
      const sellerMap = new Map<string, number>();
      for (const item of orderItemsRes.data ?? []) {
        const row = item as { product_name?: string; products?: { name: string } | { name: string }[] | null };
        const prod = row.products;
        const fromJoin = Array.isArray(prod) ? prod[0]?.name : prod?.name;
        const name = row.product_name?.trim() || fromJoin || 'Unknown';
        sellerMap.set(name, (sellerMap.get(name) ?? 0) + item.quantity);
      }
      const bestSellers = [...sellerMap.entries()]
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const revenueMonth = sum(paymentsMonth.data);
      const expensesMonth = (expensesRes.data ?? []).reduce((a, e) => a + Number(e.amount), 0);

      return {
        revenueToday: sum(paymentsToday.data),
        revenueWeek: sum(paymentsWeek.data),
        revenueMonth,
        expensesMonth,
        profitMonth: revenueMonth - expensesMonth,
        openOrders: openOrdersRes.count ?? 0,
        occupiedTables: tables.filter((t) => t.status === 'OCCUPIED').length,
        totalTables: tables.length,
        ordersToday: ordersTodayRes.count ?? 0,
        bestSellers,
      };
    },
  });
}

export function useRevenueChart(period: 'daily' | 'weekly' | 'monthly') {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['revenue-chart', restaurantId, period],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const buckets = new Map<string, number>();
      for (const p of data ?? []) {
        const d = new Date(p.created_at);
        const key =
          period === 'daily'
            ? d.toISOString().slice(0, 10)
            : period === 'weekly'
              ? `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`
              : d.toISOString().slice(0, 7);
        buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount));
      }

      return [...buckets.entries()].map(([period, revenue]) => ({ period, revenue }));
    },
  });
}
