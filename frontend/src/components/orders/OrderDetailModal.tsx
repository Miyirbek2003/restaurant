import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useOrder, useSaveOrderItems, useCloseOrder } from '@/hooks/useOrders';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { getWaiterName } from '@/lib/orderUtils';
import { buildOrderBill, SERVICE_FEE_RATE } from '@/lib/orderBilling';
import { canEditOrderItems, canPayOrder, isCountableProduct, isLineInKitchen, minLineQuantity } from '@/lib/orderEdit';
import {
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
};

type OrderDetailModalProps = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
};

export function OrderDetailModal({ orderId, open, onClose }: OrderDetailModalProps) {
  const { profile } = useAuth();
  const notify = useNotificationStore((s) => s.add);
  const mayEditRole = canPlaceOrders(profile?.role);
  const mayPayRole = canOperateCashRegister(profile?.role);
  const isManagerUser = Boolean(profile?.role && isManager(profile.role));
  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();

  const { data: order, isLoading, isError, refetch } = useOrder(open ? orderId ?? undefined : undefined);
  const [search, setSearch] = useState('');
  const [baseline, setBaseline] = useState<DraftOrderLine[]>([]);
  const [draft, setDraft] = useState<DraftOrderLine[]>([]);

  const saveItems = useSaveOrderItems();
  const closeOrder = useCloseOrder();
  const [payOpen, setPayOpen] = useState(false);

  const status = order?.status as OrderStatus | undefined;
  const canEdit = Boolean(mayEditRole && status && canEditOrderItems(status));
  const isKassaOwner = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );

  const { data: products } = useProducts(search || undefined, true);

  useEffect(() => {
    if (!open) {
      setBaseline([]);
      setDraft([]);
      setSearch('');
      return;
    }
    if (!order) return;
    const lines = serverLinesToDraft((order.order_items ?? []) as ServerOrderLine[]);
    setBaseline(lines);
    setDraft(lines);
  }, [open, order?.id, order?.updated_at]);

  const dirty = useMemo(() => isDraftDirty(baseline, draft), [baseline, draft]);

  const displayItems = draft;
  const bill = useMemo(() => {
    if (!order) return null;
    const rows = displayItems.map((d) => ({
      id: d.key,
      quantity: d.quantity,
      unit_price: d.unit_price,
      product_name: d.product_name,
    }));
    const mealSubtotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
    const taxAmount = displayItems.reduce(
      (s, d) => s + d.unit_price * d.quantity * (d.tax_rate / 100),
      0,
    );
    return buildOrderBill(rows, mealSubtotal, taxAmount);
  }, [order, displayItems]);
  const servicePct = Math.round(SERVICE_FEE_RATE * 100);
  const tableName = (order?.tables as { name: string } | null)?.name ?? t('common.takeaway');

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

    setDraft((prev) => {
      const mergeTarget = isManagerUser
        ? prev.find((l) => l.product_id === p.id)
        : prev.find((l) => l.product_id === p.id && isUnsavedOrderLine(l));
      if (mergeTarget) {
        return prev.map((l) => (l.key === mergeTarget.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: `new-${p.id}-${Date.now()}`,
          product_id: p.id,
          product_name: p.name,
          quantity: 1,
          kitchen_qty: 0,
          unit_price: Number(p.price),
          tax_rate: Number(p.tax_rate ?? 10),
        },
      ];
    });
  };

  const handleSave = async () => {
    if (!orderId || !dirty) return;
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

  const handleClose = () => {
    if (dirty && !window.confirm(t('orderDetail.discardChanges'))) return;
    onClose();
  };

  const handlePrintCheck = () => {
    if (!order || !bill) return;
    printCheckForOrder(order, tableName, restaurantFromProfile(profile?.restaurants), bill);
  };

  const confirmPay = (grandTotal: number, payments: PaymentLine[]) => {
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        order
          ? t('orderDetail.title', { n: order.order_number })
          : t('orderDetail.titleFallback')
      }
      className={canEdit ? 'max-w-2xl' : 'max-w-md'}
    >
      {isLoading && <Spinner />}
      {isError && <p className="text-sm text-red-600">{t('orderDetail.couldNotLoad')}</p>}
      {order && bill && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={statusColor[order.status as OrderStatus] ?? 'gray'} size="sm">
              {orderStatus(order.status as OrderStatus)}
            </Badge>
            <span className="text-sm text-slate-500">{tableName}</span>
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
            {displayItems.length === 0 ? (
              <p className="text-sm text-slate-500">{t('orderDetail.noItems')}</p>
            ) : (
              displayItems.map((item) => {
                const isNewLine = isUnsavedOrderLine(item);
                const floor = minLineQuantity(item.kitchen_qty, isManagerUser);
                const canDecrease = isManagerUser && item.quantity > floor;
                const canIncrease = isManagerUser;
                const canRemove = isManagerUser || isNewLine;
                const showControls = canEdit && (isManagerUser || isNewLine);
                return (
                <div key={item.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <DottedRow
                      label={`${item.quantity}× ${item.product_name || t('common.item')}`}
                      value={formatCurrency(item.unit_price * item.quantity)}
                    />
                    {isNewLine && !isManagerUser && (
                      <p className="mt-0.5 text-xs text-primary-600 dark:text-primary-400">
                        {t('orderDetail.newItemPending')}
                      </p>
                    )}
                    {isManagerUser && isLineInKitchen(item.kitchen_qty) && (
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
                        <Button
                          size="sm"
                          disabled={outOfStock || atLimit}
                          onClick={() => addProduct(p)}
                        >
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
            <DottedRow label={t('orderDetail.serviceFee', { n: servicePct })} value={formatCurrency(bill.serviceFee)} />
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-900 pt-3 dark:border-slate-100">
            <span className="text-lg font-bold">{t('orderDetail.total')}</span>
            <span className="text-xl font-bold tabular-nums">{formatCurrency(bill.grandTotal)}</span>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            {mayPayRole && status && canPayOrder(status) && (
              <>
                <Button type="button" variant="secondary" onClick={handlePrintCheck}>
                  {t('orders.printCheck')}
                </Button>
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
              </>
            )}
            {canEdit && (
              <Button type="button" loading={saveItems.isPending} disabled={!dirty} onClick={() => void handleSave()}>
                {t('common.save')}
              </Button>
            )}
          </div>
        </div>
      )}

      {order && bill && (
        <PayOrderModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          orderNumber={order.order_number}
          tableName={tableName}
          items={payItems}
          subtotal={bill.mealSubtotal}
          taxAmount={bill.taxAmount}
          loading={closeOrder.isPending}
          onConfirm={confirmPay}
          onPrintCheck={handlePrintCheck}
        />
      )}
    </Modal>
  );
}
