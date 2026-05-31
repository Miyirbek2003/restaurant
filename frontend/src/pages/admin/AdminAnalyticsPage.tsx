import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-analytics'],
    queryFn: async () => {
      const [restaurants, orders, payments] = await Promise.all([
        supabase.from('restaurants').select('id, status', { count: 'exact' }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PAID'),
        supabase.from('payments').select('amount').eq('status', 'COMPLETED'),
      ]);

      const totalRevenue = (payments.data ?? []).reduce((a, p) => a + Number(p.amount), 0);
      const active = (restaurants.data ?? []).filter((r) => r.status === 'ACTIVE').length;

      return {
        restaurantCount: restaurants.count ?? 0,
        activeRestaurants: active,
        paidOrders: orders.count ?? 0,
        totalRevenue,
      };
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Platform Analytics</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle className="text-sm text-slate-500">Restaurants</CardTitle>
          <p className="mt-2 text-3xl font-bold">{data?.restaurantCount}</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-slate-500">Active</CardTitle>
          <p className="mt-2 text-3xl font-bold">{data?.activeRestaurants}</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-slate-500">Paid Orders</CardTitle>
          <p className="mt-2 text-3xl font-bold">{data?.paidOrders}</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-slate-500">Total Revenue</CardTitle>
          <p className="mt-2 text-3xl font-bold">${data?.totalRevenue.toFixed(2)}</p>
        </Card>
      </div>
    </div>
  );
}
