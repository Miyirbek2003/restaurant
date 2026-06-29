import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useOrder, useSaveOrderItems, useCloseOrder, useDiscardOrder } from '@/hooks/useOrders';
import { useLiveSecond } from '@/hooks/useLiveSecond';
import { canDiscardOrder, discardSecondsRemaining } from '@/lib/orderDiscard';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { getTableName, getWaiterName } from '@/lib/orderUtils';
import { buildOrderBill, DEFAULT_SERVICE_FEE_RATE, type OrderBill } from '@/lib/orderBilling';
import { useServiceChargeRate } from '@/hooks/useRestaurantSettings';
import { resolveTableChargeAmount } from '@/lib/tableCharge';
import { canEditOrderItems, canPayOrder, isCountableProduct, isLineInKitchen, minLineQuantity } from '@/lib/orderEdit';
import {
  expandDraftForDisplay,
  isDraftDirty,
  isUnsavedOrderLine,
  serverLinesToDraft,
  validateOrderItemEditsForWaiter,
  type DraftOrderLine,
  type ServerOrderLine,
} from '@/lib/orderItemSave';
import { canOperateCashRegister, canPlaceOrders, isManager } from '@/lib/roles';
import { reportStockShortage, type StockFailure } from '@/lib/stock';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { printCheckForOrder, printReceiptForOrder, restaurantFromProfile } from '@/lib/receipt';
import type { PaymentLine } from '@/lib/payments';
import { t, orderStatus } from '@/i18n';
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

function DottedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-slate-300 dark:border-slate-600" />
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
    </div>
  );
}

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  tax_rate?: number;
  is_active?: boolean;
  sale_unit?: string;
};

export type OrderEditViewProps = {
  orderId: string;
  onClose: () => void;
  variant: 'page' | 'embedded';
  onRegisterCloseAttempt?: (fn: () => void) => void;
  onMetaChange?: (meta: { title: string; canEdit: boolean }) => void;
};

export function OrderEditView({
  orderId,
  onClose,
  variant,
  onRegisterCloseAttempt,
  onMetaChange,
}: OrderEditViewProps) {
  const { profile } = useAuth();
  const notify = useNotificationStore((s) => s.add);
  const mayEditRole = canPlaceOrders(profile?.role);
  const mayPayRole = canOperateCashRegister(profile?.role);
  const isManagerUser = Boolean(profile?.role && isManager(profile.role));
  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();

  const { data: order, isLoading, isError, refetch } = useOrder(orderId);
  const { data: serviceRate, isLoading: serviceRateLoading } = useServiceChargeRate();
  const resolvedServiceRate = serviceRate ?? (serviceRateLoading ? DEFAULT_SERVICE_FEE_RATE : 0);
  const [search, setSearch] = useState('');
  const [baseline, setBaseline] = useState<DraftOrderLine[]>([]);
  const [draft, setDraft] = useState<DraftOrderLine[]>([]);

  const saveItems = useSaveOrderItems();
  const closeOrder = useCloseOrder();
  const discardOrder = useDiscardOrder();
  const [payOpen, setPayOpen] = useState(false);

  const status = order?.status as OrderStatus | undefined;
  const canEdit = Boolean(mayEditRole && status && canEditOrderItems(status));
  const showDiscardCountdown = Boolean(order && canDiscardOrder(order));
  useLiveSecond(showDiscardCountdown);
  const isKassaOwner = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );

  const { data: products } = useProducts(search || undefined, true);

  useEffect(() => {
    if (!order) return;
    const lines = serverLinesToDraft((order.order_items ?? []) as ServerOrderLine[]);
    setBaseline(lines);
    setDraft(lines);
    setSearch('');
  }, [order?.id, order?.updated_at]);

  const dirty = useMemo(() => isDraftDirty(baseline, draft), [baseline, draft]);

  const displayUnits = useMemo(() => expandDraftForDisplay(draft), [draft]);
  const bill = useMemo(() => {
    if (!order) return null;
    const productSaleUnit = new Map(
      ((products ?? []) as ProductRow[]).map((p) => [p.id, p.sale_unit ?? 'PIECE']),
    );
    const rows = draft.map((d) => ({
      id: d.key,
      quantity: d.quantity,
      unit_price: d.unit_price,
      product_name: d.product_name,
      products: {
        name: d.product_name,
        sale_unit: productSaleUnit.get(d.product_id) ?? null,
      },
    }));
    const mealSubtotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
    const tableInfo = order.tables as { charge_type?: string; charge_amount?: number } | null;
    const tableCharge = resolveTableChargeAmount(tableInfo, 1);
    return buildOrderBill(rows, mealSubtotal, resolvedServiceRate, tableCharge);
  }, [order, draft, resolvedServiceRate, products]);
  const servicePct = bill ? Math.round(bill.serviceRate * 100) : 0;
  const tableName = order ? getTableName(order, t('common.takeaway')) : t('common.takeaway');

  const pageTitle = order
    ? t('orderDetail.titleWithTable', { n: order.order_number, table: tableName })
    : t('orderDetail.titleFallback');

  useEffect(() => {
    onMetaChange?.({ title: pageTitle, canEdit: Boolean(canEdit) });
  }, [pageTitle, canEdit, onMetaChange]);

  const qtyInDraft = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of draft) {
      map[line.product_id] = (map[line.product_id] ?? 0) + line.quantity;
    }
    return map;
  }, [draft]);

  const countableProducts = useMemo(() => {
    return ((products ?? []) as ProductRow[]).filter(isCountableProduct);
  }, [products]);

  const handleStockFailures = async (failures: StockFailure[]) => {
    for (const f of failures) {
      await reportStockShortage(f.product_id, f.requested, f.available);
    }
    const first = failures[0];
    notify({
      type: 'error',
      title: t('orders.notEnoughStock'),
      message:
        failures.length === 1
          ? t('orders.onlyAvailable', { name: first.product_name, n: first.available })
          : t('orderDetail.stockMultiple', { n: failures.length }),
    });
  };

  const changeLineQty = (key: string, delta: number) => {
    setDraft((prev) =>
      prev
        .map((line) => {
          if (line.key !== key) return line;
          const floor = minLineQuantity(line.kitchen_qty, isManagerUser);
          const quantity = line.quantity + delta;
          if (quantity < floor) {
            if (delta < 0) {
              notify({ type: 'warning', title: t('orderDetail.itemInKitchenLocked') });
            }
            return line;
          }
          return quantity > 0 ? { ...line, quantity } : null;
        })
        .filter((line): line is DraftOrderLine => line != null),
    );
  };

  const removeLine = (key: string) => {
    const line = draft.find((l) => l.key === key);
    if (!line) return;
    if (!isManagerUser && !isUnsavedOrderLine(line)) {
      notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
      return;
    }
    setDraft((prev) => prev.filter((l) => l.key !== key));
  };

  const addProduct = (p: ProductRow) => {
    const inOrder = qtyInDraft[p.id] ?? 0;
    if (inOrder >= p.stock_quantity && p.stock_quantity > 0) {
      void reportStockShortage(p.id, inOrder + 1, p.stock_quantity);
      notify({
        type: 'error',
        title: t('orders.notEnoughStock'),
        message: t('orders.onlyAvailable', { name: p.name, n: p.stock_quantity }),
      });
      return;
    }

    const now = Date.now();
    setDraft((prev) => [
      ...prev,
      {
        key: `new-${p.id}-${now}`,
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        kitchen_qty: 0,
        unit_price: Number(p.price),
        tax_rate: Number(p.tax_rate ?? 10),
        created_at: new Date(now).toISOString(),
      },
    ]);
  };

  const handleSave = async () => {
    if (!dirty) return;
    if (!isManagerUser && !validateOrderItemEditsForWaiter(baseline, draft)) {
      notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
      return;
    }
    try {
      await saveItems.mutateAsync({ orderId, original: baseline, draft });
      await refetch();
      notify({ type: 'success', title: t('orderDetail.saved') });
      onClose();
    } catch (err) {
      const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
      if (stockFailures?.length) {
        await handleStockFailures(stockFailures);
        return;
      }
      notify({ type: 'error', title: t('orderDetail.updateFailed'), message: getErrorMessage(err) });
    }
  };

  const attemptClose = () => {
    if (dirty && !window.confirm(t('orderDetail.discardChanges'))) return;
    onClose();
  };

  useEffect(() => {
    onRegisterCloseAttempt?.(attemptClose);
  });

  const handleDiscardOrder = () => {
    if (!order) return;
    if (!canDiscardOrder(order)) {
      notify({ type: 'warning', title: t('errors.orderDiscardWindowExpired') });
      return;
    }
    if (!window.confirm(t('orders.discardConfirm', { n: order.order_number }))) return;
    discardOrder.mutate(order.id, {
      onSuccess: () => {
        notify({ type: 'success', title: t('orders.discardSuccess') });
        onClose();
      },
      onError: (err) =>
        notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
    });
  };

  const handlePrintCheck = (checkBill: OrderBill) => {
    if (!order) return;
    printCheckForOrder(order, tableName, restaurantFromProfile(profile?.restaurants), checkBill);
  };

  const confirmPay = (grandTotal: number, payments: PaymentLine[], paidBill: OrderBill) => {
    if (!order || !openKassa) return;
    closeOrder.mutate(
      {
        orderId: order.id,
        amount: grandTotal,
        payments,
        tableId: order.table_id,
        cashRegisterSessionId: openKassa.id,
      },
      {
        onSuccess: () => {
          notify({
            type: 'success',
            title: t('orders.paymentRecorded'),
            message: formatCurrency(grandTotal),
          });
          printReceiptForOrder(
            order,
            tableName,
            restaurantFromProfile(profile?.restaurants),
            payments,
            new Date(),
            paidBill,
          );
          setPayOpen(false);
          onClose();
        },
        onError: (err) =>
          notify({ type: 'error', title: t('orders.paymentFailed'), message: getErrorMessage(err) }),
      },
    );
  };

  const payItems =
    (order?.order_items as
      | { id: string; quantity: number; unit_price: number; products?: { name: string } | null }[]
      | undefined)?.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      products: item.products ?? null,
    })) ?? [];

  if (isLoading) return <Spinner />;
  if (isError) return <p className="text-sm text-red-600">{t('orderDetail.couldNotLoad')}</p>;
  if (!order || !bill) return null;

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={statusColor[order.status as OrderStatus] ?? 'gray'} size="sm">
          {orderStatus(order.status as OrderStatus)}
        </Badge>
        {dirty && (
          <Badge color="yellow" size="sm">
            {t('orderDetail.unsaved')}
          </Badge>
        )}
      </div>

      {canEdit && (
        <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          {isManagerUser ? t('orderDetail.editHintManager') : t('orderDetail.editHintWaiter')}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">{t('orderDetail.table')}</dt>
        <dd className="font-medium">{tableName}</dd>
        <dt className="text-slate-500">{t('orderDetail.waiter')}</dt>
        <dd className="font-medium">{getWaiterName(order)}</dd>
        <dt className="text-slate-500">{t('orderDetail.created')}</dt>
        <dd className="font-medium">{format(new Date(order.created_at), 'PPp')}</dd>
        {order.sent_to_kitchen_at && (
          <>
            <dt className="text-slate-500">{t('orderDetail.sentKitchen')}</dt>
            <dd className="font-medium">{format(new Date(order.sent_to_kitchen_at), 'PPp')}</dd>
          </>
        )}
        {order.paid_at && (
          <>
            <dt className="text-slate-500">{t('orderDetail.paidAt')}</dt>
            <dd className="font-medium">{format(new Date(order.paid_at), 'PPp')}</dd>
          </>
        )}
      </dl>

      {order.notes && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <span className="font-medium text-slate-700 dark:text-slate-300">{t('orderDetail.notes')}: </span>
          {order.notes}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('orderDetail.items')}</h3>
        {displayUnits.length === 0 ? (
          <p className="text-sm text-slate-500">{t('orderDetail.noItems')}</p>
        ) : (
          displayUnits.map(({ line: item, unitIndex, isLastUnit }) => {
            const isNewLine = isUnsavedOrderLine(item);
            const floor = minLineQuantity(item.kitchen_qty, isManagerUser);
            const canDecrease = isManagerUser && item.quantity > floor;
            const canIncrease = isManagerUser;
            const canRemove = isManagerUser || isNewLine;
            const showControls = canEdit && isLastUnit && (isManagerUser || isNewLine);
            return (
              <div key={`${item.key}-${unitIndex}`} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <DottedRow
                    label={item.product_name || t('common.item')}
                    value={formatCurrency(item.unit_price)}
                  />
                  {isNewLine && !isManagerUser && isLastUnit && (
                    <p className="mt-0.5 text-xs text-primary-600 dark:text-primary-400">
                      {t('orderDetail.newItemPending')}
                    </p>
                  )}
                  {isManagerUser && isLineInKitchen(item.kitchen_qty) && isLastUnit && (
                    <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                      {t('orderDetail.inKitchenQty', { n: item.kitchen_qty })}
                    </p>
                  )}
                </div>
                {showControls && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isManagerUser && (
                      <>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                          disabled={!canDecrease}
                          onClick={() => changeLineQty(item.key, -1)}
                          aria-label={t('orderDetail.decreaseQty')}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                          disabled={!canIncrease}
                          onClick={() => changeLineQty(item.key, 1)}
                          aria-label={t('orderDetail.increaseQty')}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
                      disabled={!canRemove}
                      onClick={() => removeLine(item.key)}
                      aria-label={t('orderDetail.removeItem')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {canEdit && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('orderDetail.addItems')}</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder={t('orderDetail.searchProducts')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {countableProducts.length === 0 ? (
              <li className="text-sm text-slate-500">{t('orderDetail.noProducts')}</li>
            ) : (
              countableProducts.map((p) => {
                const inOrder = qtyInDraft[p.id] ?? 0;
                const outOfStock = p.stock_quantity <= 0;
                const atLimit = inOrder >= p.stock_quantity && p.stock_quantity > 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {p.name}
                      <span className="ml-1 text-slate-500">
                        ({p.stock_quantity} {t('orderDetail.inStock')})
                      </span>
                    </span>
                    <Button size="sm" disabled={outOfStock || atLimit} onClick={() => addProduct(p)}>
                      {t('common.add')}
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      <hr className="border-slate-200 dark:border-slate-700" />

      <div className="space-y-2">
        <DottedRow label={t('orderDetail.mealSubtotal')} value={formatCurrency(bill.mealSubtotal)} />
        {Number(order.discount_amount) > 0 && (
          <DottedRow label={t('orderDetail.discount')} value={`−${formatCurrency(Number(order.discount_amount))}`} />
        )}
        {bill.tableCharge > 0 && (
          <DottedRow label={t('orderDetail.tableCharge')} value={formatCurrency(bill.tableCharge)} />
        )}
        <DottedRow label={t('orderDetail.serviceFee', { n: servicePct })} value={formatCurrency(bill.serviceFee)} />
        {bill.serviceRate === 0 && <p className="text-xs text-slate-500">{t('orders.serviceFeeZeroHint')}</p>}
      </div>

      <div className="flex items-baseline justify-between border-t border-slate-900 pt-3 dark:border-slate-100">
        <span className="text-lg font-bold">{t('orderDetail.total')}</span>
        <span className="text-xl font-bold tabular-nums">{formatCurrency(bill.grandTotal)}</span>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={attemptClose}>
          {t('common.cancel')}
        </Button>
        {showDiscardCountdown && (
          <Button
            type="button"
            variant="danger"
            loading={discardOrder.isPending}
            onClick={() => void handleDiscardOrder()}
          >
            {t('orders.discardOrder')} ({discardSecondsRemaining(order.created_at)}s)
          </Button>
        )}
        {mayPayRole && status && canPayOrder(status) && (
          <Button
            type="button"
            disabled={Boolean(openKassa && !isKassaOwner)}
            onClick={() => {
              if (!openKassa) {
                notify({ type: 'warning', title: t('kassa.mustOpenFirst') });
                return;
              }
              if (!isKassaOwner) {
                notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
                return;
              }
              setPayOpen(true);
            }}
          >
            {t('orders.pay')}
          </Button>
        )}
        {canEdit && (
          <Button type="button" loading={saveItems.isPending} disabled={!dirty} onClick={() => void handleSave()}>
            {t('common.save')}
          </Button>
        )}
      </div>

      <PayOrderModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        orderNumber={order.order_number}
        tableName={tableName}
        table={order.tables as { charge_type?: string; charge_amount?: number } | null}
        items={payItems}
        subtotal={bill.mealSubtotal}
        loading={closeOrder.isPending}
        onConfirm={confirmPay}
        onPrintCheck={handlePrintCheck}
      />
    </div>
  );

  if (variant === 'page') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={attemptClose}>
            <ArrowLeft className="h-4 w-4" /> {t('common.back')}
          </Button>
          <h2 className="text-2xl font-bold">{pageTitle}</h2>
        </div>
        {content}
      </div>
    );
  }

  return content;
}
