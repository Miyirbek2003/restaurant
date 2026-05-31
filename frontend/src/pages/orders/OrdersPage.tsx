import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { useOrders, useSendToKitchen, useCloseOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { getWaiterName } from '@/lib/orderUtils';
import { isManager } from '@/lib/roles';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import type { OrderStatus } from '@/types';

const statusColor: Record<string, 'green' | 'yellow' | 'blue' | 'gray' | 'red'> = {
  DRAFT: 'gray',
  NEW: 'blue',
  PREPARING: 'yellow',
  READY: 'green',
  SERVED: 'green',
  PAID: 'green',
  CANCELLED: 'red',
};

type ViewFilter = 'all' | 'draft' | 'kitchen' | 'payment' | 'paid';

const VIEW_LABELS: Record<ViewFilter, string> = {
  all: 'All',
  draft: 'Draft',
  kitchen: 'In kitchen',
  payment: 'Ready to pay',
  paid: 'Paid',
};

const KITCHEN_STATUSES: OrderStatus[] = ['NEW', 'PREPARING', 'READY'];

type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  table_id: string | null;
  tables: { name: string } | null;
  staff?: { name: string; role?: string } | null;
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    products?: { name: string } | null;
  }[];
};

function matchesView(order: OrderRow, view: ViewFilter): boolean {
  if (view === 'all') return order.status !== 'CANCELLED';
  if (view === 'draft') return order.status === 'DRAFT';
  if (view === 'kitchen') return KITCHEN_STATUSES.includes(order.status);
  if (view === 'payment') return order.status === 'SERVED';
  if (view === 'paid') return order.status === 'PAID';
  return true;
}

function kitchenAction(
  status: OrderStatus,
): { label: string; next: OrderStatus } | null {
  if (status === 'NEW') return { label: 'Start cooking', next: 'PREPARING' };
  if (status === 'PREPARING') return { label: 'Ready', next: 'READY' };
  if (status === 'READY') return { label: 'Served', next: 'SERVED' };
  return null;
}

export function OrdersPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const manager = role ? isManager(role) : false;
  const notify = useNotificationStore((s) => s.add);

  const { data: orders, isLoading } = useOrders();
  const sendKitchen = useSendToKitchen();
  const closeOrder = useCloseOrder();
  const updateStatus = useUpdateOrderStatus();

  const [view, setView] = useState<ViewFilter>('all');
  const [payOrder, setPayOrder] = useState<OrderRow | null>(null);

  const orderList = (orders ?? []) as OrderRow[];

  const counts = useMemo(() => {
    const c: Record<ViewFilter, number> = { all: 0, draft: 0, kitchen: 0, payment: 0, paid: 0 };
    for (const o of orderList) {
      if (o.status !== 'CANCELLED') c.all += 1;
      if (o.status === 'DRAFT') c.draft += 1;
      if (KITCHEN_STATUSES.includes(o.status)) c.kitchen += 1;
      if (o.status === 'SERVED') c.payment += 1;
      if (o.status === 'PAID') c.paid += 1;
    }
    return c;
  }, [orderList]);

  const filtered = useMemo(
    () => orderList.filter((o) => matchesView(o, view)),
    [orderList, view],
  );

  const confirmPay = (grandTotal: number) => {
    if (!payOrder) return;
    closeOrder.mutate(
      {
        orderId: payOrder.id,
        amount: grandTotal,
        tableId: payOrder.table_id,
      },
      {
        onSuccess: () => {
          notify({ type: 'success', title: 'Payment recorded', message: formatCurrency(grandTotal) });
          setPayOrder(null);
        },
        onError: (err) =>
          notify({ type: 'error', title: 'Payment failed', message: getErrorMessage(err) }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Orders</h2>
          <p className="text-sm text-slate-500">Track food preparation and payments</p>
        </div>
        <Link to="/orders/new">
          <Button>
            <Plus className="h-4 w-4" /> New order
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as ViewFilter[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={view === key ? 'primary' : 'secondary'}
            onClick={() => setView(key)}
          >
            {VIEW_LABELS[key]} ({counts[key]})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No orders here"
          description={
            view === 'kitchen'
              ? 'Send draft orders to the kitchen to see them here.'
              : 'Create an order from Tables or New order.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const action = kitchenAction(order.status);
            const items = order.order_items ?? [];
            const tableName = order.tables?.name ?? 'Takeaway';

            return (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      #{order.order_number}
                      <span className="ml-2 font-normal text-slate-500">· {tableName}</span>
                    </p>
                    <p className="text-sm text-slate-500">{getWaiterName(order)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={statusColor[order.status] ?? 'gray'} size="sm">
                      {order.status}
                    </Badge>
                    <span className="font-bold">{formatCurrency(Number(order.total))}</span>
                  </div>
                </div>

                {items.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                        <span>
                          {item.quantity}× {(item.products as { name: string } | null)?.name ?? 'Item'}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(Number(item.unit_price) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {order.status === 'DRAFT' && (
                    <>
                      <Link to={`/orders/${order.id}/edit`}>
                        <Button size="sm" variant="secondary">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        loading={sendKitchen.isPending}
                        onClick={() => sendKitchen.mutate(order.id)}
                      >
                        Send to kitchen
                      </Button>
                    </>
                  )}
                  {action && (
                    <Button
                      size="sm"
                      loading={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: order.id, status: action.next })}
                    >
                      {action.label}
                    </Button>
                  )}
                  {manager && order.status === 'SERVED' && (
                    <Button size="sm" onClick={() => setPayOrder(order)}>
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payOrder && (
        <PayOrderModal
          open
          onClose={() => setPayOrder(null)}
          orderNumber={payOrder.order_number}
          tableName={payOrder.tables?.name ?? 'Takeaway'}
          items={payOrder.order_items ?? []}
          subtotal={Number(payOrder.subtotal)}
          taxAmount={Number(payOrder.tax_amount)}
          loading={closeOrder.isPending}
          onConfirm={confirmPay}
        />
      )}
    </div>
  );
}
