import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useOrders, useSendToKitchen, useCloseOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { printCheckForOrder, printReceiptForOrder, restaurantFromProfile } from '@/lib/receipt';
import type { PaymentLine } from '@/lib/payments';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { getWaiterName } from '@/lib/orderUtils';
import { canEditOrderItems, canPayOrder } from '@/lib/orderEdit';
import { canCreateOrders, canPlaceOrders, canOperateCashRegister } from '@/lib/roles';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { reportStockShortage, type StockFailure } from '@/lib/stock';
import { t, orderStatus } from '@/i18n';
import { defaultDateRangeMonth, matchesDateRange, matchesSearch } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
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

type ViewFilter = 'active' | 'all' | 'draft' | 'kitchen' | 'payment' | 'paid';

const VIEW_LABELS: Record<ViewFilter, string> = {
  active: t('orders.active'),
  all: t('common.all'),
  draft: t('orders.draft'),
  kitchen: t('orders.inKitchen'),
  payment: t('orders.readyToPay'),
  paid: t('orders.paid'),
};

const VIEW_ORDER: ViewFilter[] = ['active', 'kitchen', 'payment', 'paid', 'draft', 'all'];

const KITCHEN_STATUSES: OrderStatus[] = ['NEW', 'PREPARING', 'READY'];

type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  table_id: string | null;
  created_at: string;
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
  if (view === 'active') return order.status !== 'PAID' && order.status !== 'CANCELLED';
  if (view === 'all') return order.status !== 'CANCELLED';
  if (view === 'draft') return order.status === 'DRAFT';
  if (view === 'kitchen') return KITCHEN_STATUSES.includes(order.status);
  if (view === 'payment') return canPayOrder(order.status);
  if (view === 'paid') return order.status === 'PAID';
  return true;
}

function kitchenAction(
  status: OrderStatus,
): { label: string; next: OrderStatus } | null {
  if (status === 'NEW') return { label: t('orders.startCooking'), next: 'PREPARING' };
  if (status === 'PREPARING') return { label: t('orders.markReady'), next: 'READY' };
  if (status === 'READY') return { label: t('orders.markServed'), next: 'SERVED' };
  return null;
}

export function OrdersPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const notify = useNotificationStore((s) => s.add);

  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();
  const { data: orders, isLoading } = useOrders();
  const sendKitchen = useSendToKitchen();
  const closeOrder = useCloseOrder();
  const updateStatus = useUpdateOrderStatus();

  const [view, setView] = useState<ViewFilter>('active');
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeMonth();
    return { search: '', dateFrom: range.from, dateTo: range.to };
  });
  const [payOrder, setPayOrder] = useState<OrderRow | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const canUpdateItems = canPlaceOrders(profile?.role);
  const canPay = canOperateCashRegister(profile?.role);
  const isKassaOwner = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );
  const cashierCreateBlocked = Boolean(profile?.role === 'CASHIER' && openKassa && !isKassaOwner);

  const startPay = (order: OrderRow) => {
    if (!openKassa) {
      notify({ type: 'warning', title: t('kassa.mustOpenFirst') });
      navigate('/kassa');
      return;
    }
    if (!isKassaOwner) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    setPayOrder(order);
  };

  const orderList = (orders ?? []) as OrderRow[];

  const periodOrders = useMemo(
    () =>
      orderList
        .filter((o) => matchesDateRange(o.created_at, filters.dateFrom, filters.dateTo))
        .filter((o) =>
          matchesSearch(filters.search, String(o.order_number), o.tables?.name, getWaiterName(o)),
        ),
    [orderList, filters],
  );

  const counts = useMemo(() => {
    const c: Record<ViewFilter, number> = {
      active: 0,
      all: 0,
      draft: 0,
      kitchen: 0,
      payment: 0,
      paid: 0,
    };
    for (const o of periodOrders) {
      if (o.status !== 'PAID' && o.status !== 'CANCELLED') c.active += 1;
      if (o.status !== 'CANCELLED') c.all += 1;
      if (o.status === 'DRAFT') c.draft += 1;
      if (KITCHEN_STATUSES.includes(o.status)) c.kitchen += 1;
      if (canPayOrder(o.status)) c.payment += 1;
      if (o.status === 'PAID') c.paid += 1;
    }
    return c;
  }, [periodOrders]);

  const filtered = useMemo(
    () => periodOrders.filter((o) => matchesView(o, view)),
    [periodOrders, view],
  );

  const sendToKitchen = (orderId: string) => {
    sendKitchen.mutate(orderId, {
      onSuccess: () => notify({ type: 'success', title: t('orders.sentToKitchenSuccess') }),
      onError: async (err) => {
        const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
        if (stockFailures?.length) {
          for (const f of stockFailures) {
            await reportStockShortage(f.product_id, f.requested, f.available);
          }
          const first = stockFailures[0];
          notify({
            type: 'error',
            title: t('orders.notEnoughStock'),
            message: t('orders.onlyAvailable', { name: first.product_name, n: first.available }),
          });
          return;
        }
        notify({ type: 'error', title: t('orders.sendKitchenFailed'), message: getErrorMessage(err) });
      },
    });
  };

  const printCheck = (order: OrderRow) => {
    printCheckForOrder(
      order,
      order.tables?.name ?? t('common.takeaway'),
      restaurantFromProfile(profile?.restaurants),
    );
  };

  const confirmPay = (grandTotal: number, payments: PaymentLine[]) => {
    if (!payOrder || !openKassa) return;
    const tableName = payOrder.tables?.name ?? t('common.takeaway');
    closeOrder.mutate(
      {
        orderId: payOrder.id,
        amount: grandTotal,
        payments,
        tableId: payOrder.table_id,
        cashRegisterSessionId: openKassa.id,
      },
      {
        onSuccess: () => {
          notify({ type: 'success', title: t('orders.paymentRecorded'), message: formatCurrency(grandTotal) });
          printReceiptForOrder(payOrder, tableName, restaurantFromProfile(profile?.restaurants), payments);
          setPayOrder(null);
        },
        onError: (err) =>
          notify({ type: 'error', title: t('orders.paymentFailed'), message: getErrorMessage(err) }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">{t('orders.title')}</h2>
          <p className="text-sm text-slate-500">{t('orders.subtitle')}</p>
        </div>
        {canCreateOrders(profile?.role) && !cashierCreateBlocked && (
          <Link to="/orders/new">
            <Button>
              <Plus className="h-4 w-4" /> {t('orders.newOrder')}
            </Button>
          </Link>
        )}
      </div>

      <ListFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder={t('orders.searchPlaceholder')}
      />

      <div className="flex flex-wrap gap-2">
        {VIEW_ORDER.map((key) => (
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
          title={t('orders.noOrders')}
          description={
            view === 'kitchen' ? t('orders.noOrdersKitchen') : t('orders.noOrdersDefault')
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const action = kitchenAction(order.status);
            const items = order.order_items ?? [];
            const tableName = order.tables?.name ?? t('common.takeaway');
            const isTakeaway = !order.tables?.name;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t('orders.orderNumber', { n: order.order_number })}
                    </p>
                    <p
                      className={
                        isTakeaway
                          ? 'mt-1 text-lg font-semibold text-slate-600 dark:text-slate-300'
                          : 'mt-1 text-2xl font-bold tracking-tight text-primary-700 dark:text-primary-300'
                      }
                    >
                      {tableName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">{getWaiterName(order)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={statusColor[order.status] ?? 'gray'} size="sm">
                      {orderStatus(order.status)}
                    </Badge>
                    <span className="font-bold">{formatCurrency(Number(order.total))}</span>
                  </div>
                </div>

                {items.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                        <span>
                          {item.quantity}× {(item.products as { name: string } | null)?.name ?? t('common.item')}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(Number(item.unit_price) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {canUpdateItems && canEditOrderItems(order.status) && (
                    <Button size="sm" variant="secondary" onClick={() => setDetailOrderId(order.id)}>
                      {t('orders.updateItems')}
                    </Button>
                  )}
                  {order.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      loading={sendKitchen.isPending}
                      onClick={() => sendToKitchen(order.id)}
                    >
                      {t('orders.sendToKitchen')}
                    </Button>
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
                  {canPay && canPayOrder(order.status) && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => printCheck(order)}>
                        {t('orders.printCheck')}
                      </Button>
                      <Button size="sm" disabled={Boolean(openKassa && !isKassaOwner)} onClick={() => startPay(order)}>
                        {t('orders.pay')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OrderDetailModal
        orderId={detailOrderId}
        open={detailOrderId !== null}
        onClose={() => setDetailOrderId(null)}
      />

      {payOrder && (
        <PayOrderModal
          open
          onClose={() => setPayOrder(null)}
          orderNumber={payOrder.order_number}
          tableName={payOrder.tables?.name ?? t('common.takeaway')}
          items={payOrder.order_items ?? []}
          subtotal={Number(payOrder.subtotal)}
          taxAmount={Number(payOrder.tax_amount)}
          loading={closeOrder.isPending}
          onConfirm={confirmPay}
          onPrintCheck={() => {
            if (!payOrder) return;
            printCheckForOrder(
              payOrder,
              payOrder.tables?.name ?? t('common.takeaway'),
              restaurantFromProfile(profile?.restaurants),
            );
          }}
        />
      )}
    </div>
  );
}
