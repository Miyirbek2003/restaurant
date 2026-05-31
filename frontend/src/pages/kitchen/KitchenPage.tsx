import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { useRestaurantId } from '@/contexts/AuthContext';
import { useKitchenQueue, useUpdateOrderStatus } from '@/hooks/useOrders';
import { getErrorMessage } from '@/lib/errors';
import type { OrderStatus } from '@/types';

const columns: { key: OrderStatus; label: string; color: 'blue' | 'yellow' | 'green' }[] = [
  { key: 'NEW', label: 'New', color: 'blue' },
  { key: 'PREPARING', label: 'Preparing', color: 'yellow' },
  { key: 'READY', label: 'Ready', color: 'green' },
];

export function KitchenPage() {
  const restaurantId = useRestaurantId();
  const { data: orders, isLoading, isError, error, refetch } = useKitchenQueue();
  const updateStatus = useUpdateOrderStatus();

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Kitchen Display</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Kitchen Display</h2>
        <Card className="max-w-lg space-y-3 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">Could not load kitchen queue</p>
          <p className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(error)}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Kitchen Display</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const filtered = (orders ?? []).filter((o) => o.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <CardTitle>{col.label}</CardTitle>
                <Badge color={col.color}>{filtered.length}</Badge>
              </div>
              {filtered.map((order) => (
                <Card key={order.id}>
                  <p className="font-bold">#{order.order_number}</p>
                  <p className="text-sm text-slate-500">
                    {(order.tables as { name: string } | null)?.name ?? 'No table'}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(order.order_items ?? []).map((item: { id: string; quantity: number; products?: { name: string } | null }) => (
                      <li key={item.id}>
                        {item.quantity}x {(item.products as { name: string } | null)?.name}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    {col.key === 'NEW' && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: order.id, status: 'PREPARING' })}>
                        Start
                      </Button>
                    )}
                    {col.key === 'PREPARING' && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: order.id, status: 'READY' })}>
                        Ready
                      </Button>
                    )}
                    {col.key === 'READY' && (
                      <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: order.id, status: 'SERVED' })}>
                        Served
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
