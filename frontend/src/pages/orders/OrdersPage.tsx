import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useOrders, useSendToKitchen, useCloseOrder, useUpdateOrderStatus, useDiscardOrder } from '@/hooks/useOrders';
import { useLiveSecond } from '@/hooks/useLiveSecond';
import { canDiscardOrder, discardSecondsRemaining } from '@/lib/orderDiscard';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { printCheckForOrder, printReceiptForOrder, restaurantFromProfile } from '@/lib/receipt';
import type { PaymentLine } from '@/lib/payments';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { getWaiterName, orderDateForFilter } from '@/lib/orderUtils';
import { canEditOrderItems, canPayOrder } from '@/lib/orderEdit';
import { canCreateOrders, canPlaceOrders, canOperateCashRegister, isWaiter } from '@/lib/roles';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { reportStockShortage, type StockFailure } from '@/lib/stock';
import { t, orderStatus } from '@/i18n';
import { matchesDateRange, matchesSearch, todayRange, yesterdayRange } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import type { OrderStatus } from '@/types';
import { buildOrderBill, DEFAULT_SERVICE_FEE_RATE, type OrderBill } from '@/lib/orderBilling';
import { resolveTableChargeAmount } from '@/lib/tableCharge';
import { computeOrderCardTotals } from '@/lib/orderCardTotals';
import { useServiceChargeRate } from '@/hooks/useRestaurantSettings';

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
  discount_amount?: number;
  total: number;
  table_id: string | null;
  staff_id?: string | null;
  created_at: string;
  paid_at: string | null;
  tables: { name: string; charge_type?: string; charge_amount?: number } | null;
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
  const { data: serviceRate, isLoading: serviceRateLoading } = useServiceChargeRate();
  const resolvedServiceRate = serviceRate ?? (serviceRateLoading ? DEFAULT_SERVICE_FEE_RATE : 0);
  const sendKitchen = useSendToKitchen();
  const closeOrder = useCloseOrder();
  const updateStatus = useUpdateOrderStatus();
  const discardOrder = useDiscardOrder();

  const [view, setView] = useState<ViewFilter>('active');
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = todayRange();
    return { search: '', dateFrom: range.from, dateTo: range.to };
  });

  const applyDateRange = (range: { from: string; to: string }) =>
    setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to }));

  const resetFilters = () => {
    const range = todayRange();
    setFilters({ search: '', dateFrom: range.from, dateTo: range.to });
  };
  const [payOrder, setPayOrder] = useState<OrderRow | null>(null);
  const canUpdateItems = canPlaceOrders(profile?.role);
  const canPay = canOperateCashRegister(profile?.role);
  const isWaiterUser = Boolean(profile?.role && isWaiter(profile.role));
  const ownsOrder = (order: OrderRow) =>
    !isWaiterUser || (myStaffId != null && order.staff_id === myStaffId);
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

  const printCheck = (order: OrderRow) => {
    const items = (order.order_items ?? []).map((it) => ({
      id: it.id,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      products: it.products ?? null,
    }));
    const tableCharge = resolveTableChargeAmount(order.tables, 1);
    const bill = buildOrderBill(items, Number(order.subtotal), resolvedServiceRate, tableCharge);
    printCheckForOrder(
      order,
      order.tables?.name ?? t('common.takeaway'),
      restaurantFromProfile(profile?.restaurants),
      bill,
    );
  };

  const handleDiscard = (order: OrderRow) => {
    if (!canDiscardOrder(order)) {
      notify({ type: 'warning', title: t('errors.orderDiscardWindowExpired') });
      return;
    }
    if (!window.confirm(t('orders.discardConfirm', { n: order.order_number }))) return;
    discardOrder.mutate(order.id, {
      onSuccess: () => notify({ type: 'success', title: t('orders.discardSuccess') }),
      onError: (err) =>
        notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
    });
  };

  const orderList = (orders ?? []) as OrderRow[];

  const searchedOrders = useMemo(
    () =>
      orderList.filter((o) =>
        matchesSearch(filters.search, String(o.order_number), o.tables?.name, getWaiterName(o)),
      ),
    [orderList, filters.search],
  );

  const periodOrders = useMemo(
    () =>
      searchedOrders.filter((o) =>
        matchesDateRange(orderDateForFilter(o), filters.dateFrom, filters.dateTo),
      ),
    [searchedOrders, filters.dateFrom, filters.dateTo],
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
      if (o.status === 'DRAFT') c.draft += 1;
      if (KITCHEN_STATUSES.includes(o.status)) c.kitchen += 1;
      if (canPayOrder(o.status)) c.payment += 1;
      if (o.status === 'PAID') c.paid += 1;
    }
    // "All" ignores the date range and shows every non-cancelled order.
    c.all = searchedOrders.filter((o) => o.status !== 'CANCELLED').length;
    return c;
  }, [periodOrders, searchedOrders]);

  const filtered = useMemo(() => {
    const source = view === 'all' ? searchedOrders : periodOrders;
    return source.filter((o) => matchesView(o, view));
  }, [periodOrders, searchedOrders, view]);

  const hasDiscardableOrders = useMemo(
    () => Boolean(canUpdateItems && filtered.some((o) => canDiscardOrder(o))),
    [canUpdateItems, filtered],
  );
  useLiveSecond(hasDiscardableOrders);

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

  const confirmPay = (grandTotal: number, payments: PaymentLine[], bill: OrderBill) => {
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
          printReceiptForOrder(payOrder, tableName, restaurantFromProfile(profile?.restaurants), payments, new Date(), bill);
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
        <div className="flex items-center gap-2">
          {canCreateOrders(profile?.role) && !cashierCreateBlocked && (
            <Link to="/orders/new">
              <Button>
                <Plus className="h-4 w-4" /> {t('orders.newOrder')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ListFilters
        value={filters}
        onChange={setFilters}
        onReset={resetFilters}
        searchPlaceholder={t('orders.searchPlaceholder')}
        beforeDates={
          <div className="flex w-full shrink-0 flex-wrap items-end gap-2 sm:w-auto">
            <Button size="sm" variant="secondary" onClick={() => applyDateRange(todayRange())}>
              {t('filters.today')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyDateRange(yesterdayRange())}>
              {t('filters.yesterday')}
            </Button>
          </div>
        }
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
            const totals = computeOrderCardTotals(order, resolvedServiceRate);

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
                    {order.paid_at && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {t('orderDetail.paidAt')}: {format(new Date(order.paid_at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={statusColor[order.status] ?? 'gray'} size="sm">
                      {orderStatus(order.status)}
                    </Badge>
                    <span className="font-bold tabular-nums">{formatCurrency(totals.displayTotal)}</span>
                  </div>
                </div>

                {(items.length > 0 || totals.displayTotal > 0) && (
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
                    <li className="flex justify-between gap-4 border-t border-slate-100 pt-2 text-slate-600 dark:border-slate-800 dark:text-slate-400">
                      <span>{t('orders.orderSubtotal')}</span>
                      <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
                    </li>
                    {totals.showServiceLine && (
                      <li className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                        <span>{t('payModal.serviceFee', { n: totals.servicePct })}</span>
                        <span className="tabular-nums">{formatCurrency(totals.serviceFee)}</span>
                      </li>
                    )}
                    {totals.tableCharge > 0.01 && (
                      <li className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                        <span>{t('orderDetail.tableCharge')}</span>
                        <span className="tabular-nums">{formatCurrency(totals.tableCharge)}</span>
                      </li>
                    )}
                    {totals.discount > 0.01 && (
                      <li className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                        <span>{t('orderDetail.discount')}</span>
                        <span className="tabular-nums">−{formatCurrency(totals.discount)}</span>
                      </li>
                    )}
                    <li className="flex justify-between gap-4 pt-1 font-semibold text-slate-800 dark:text-slate-200">
                      <span>{t('orders.orderTotal')}</span>
                      <span className="tabular-nums">{formatCurrency(totals.displayTotal)}</span>
                    </li>
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {canUpdateItems && canDiscardOrder(order) && ownsOrder(order) && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={discardOrder.isPending && discardOrder.variables === order.id}
                      onClick={() => handleDiscard(order)}
                    >
                      {t('orders.discardOrder')}
                      <span className="text-xs opacity-80">
                        ({discardSecondsRemaining(order.created_at)}s)
                      </span>
                    </Button>
                  )}
                  {canUpdateItems && canEditOrderItems(order.status) && ownsOrder(order) && (
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/orders/${order.id}/edit`)}>
                      {t('orders.updateItems')}
                    </Button>
                  )}
                  {isWaiterUser && !ownsOrder(order) && canEditOrderItems(order.status) && (
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/orders/${order.id}/edit`)}>
                      {t('orders.viewOrder')}
                    </Button>
                  )}
                  {order.status === 'DRAFT' && ownsOrder(order) && (
                    <Button
                      size="sm"
                      loading={sendKitchen.isPending && sendKitchen.variables === order.id}
                      onClick={() => sendToKitchen(order.id)}
                    >
                      {t('orders.sendToKitchen')}
                    </Button>
                  )}
                  {action && (
                    <Button
                      size="sm"
                      loading={updateStatus.isPending && updateStatus.variables?.id === order.id}
                      onClick={() => updateStatus.mutate({ id: order.id, status: action.next })}
                    >
                      {action.label}
                    </Button>
                  )}
                  {canPay && canPayOrder(order.status) && (
                    <Button size="sm" disabled={Boolean(openKassa && !isKassaOwner)} onClick={() => startPay(order)}>
                      {t('orders.pay')}
                    </Button>
                  )}
                  {canPay && items.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => printCheck(order)}>
                      {t('payModal.printCheck')}
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
          tableName={payOrder.tables?.name ?? t('common.takeaway')}
          table={payOrder.tables}
          items={payOrder.order_items ?? []}
          subtotal={Number(payOrder.subtotal)}
          loading={closeOrder.isPending}
          onConfirm={confirmPay}
          onPrintCheck={(bill) => {
            if (!payOrder) return;
            printCheckForOrder(
              payOrder,
              payOrder.tables?.name ?? t('common.takeaway'),
              restaurantFromProfile(profile?.restaurants),
              bill,
            );
          }}
        />
      )}

    </div>
  );
}
