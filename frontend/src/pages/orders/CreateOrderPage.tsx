import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Minus, Plus, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrderProductPicker } from '@/components/orders/OrderProductPicker';
import { PayOrderModal } from '@/components/orders/PayOrderModal';
import { WeightEntryModal } from '@/components/orders/WeightEntryModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { useTables, useTableIdsWithOpenOrders } from '@/hooks/useTables';
import { useWaiters } from '@/hooks/useEmployees';
import {
  useCloseOrder,
  useCreateOrderWithItems,
  useOrder,
  useSaveOrderItems,
  useSendToKitchen,
} from '@/hooks/useOrders';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { useAuth } from '@/contexts/AuthContext';
import { canOperateCashRegister, isCashier, isManager, isWaiter } from '@/lib/roles';
import { buildOrderBill, DEFAULT_SERVICE_FEE_RATE, type OrderBill } from '@/lib/orderBilling';
import { useServiceChargeRate } from '@/hooks/useRestaurantSettings';
import { resolveTableChargeAmount } from '@/lib/tableCharge';
import { printCheckForOrder, printReceiptForOrder, restaurantFromProfile } from '@/lib/receipt';
import type { PaymentLine } from '@/lib/payments';
import { cn, formatCurrency } from '@/lib/utils';
import { cartQtyForProduct, reportStockShortage, type StockFailure } from '@/lib/stock';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { isTableAvailableForNewOrder } from '@/lib/tableOrder';
import { useScheduledBookingsByTable } from '@/hooks/useTableBookings';
import { getTableBookingWarning } from '@/lib/tableBookingNotify';
import { formatSaleQuantity, isWeightProduct, isWeightZero, roundWeightKg, type ProductSaleUnit } from '@/lib/weight';
import { canEditOrderItems, canPayOrder } from '@/lib/orderEdit';
import {
  applyCartQtyChange,
  baselineQtyForProduct,
  canDecreaseCartQty,
  draftToCart,
  type ComposerCartLine,
} from '@/lib/orderDraftCart';
import {
  isDraftDirty,
  serverLinesToDraft,
  validateOrderItemEditsForWaiter,
  type DraftOrderLine,
  type ServerOrderLine,
} from '@/lib/orderItemSave';
import { getTableName, getWaiterName } from '@/lib/orderUtils';
import { t, tableStatus, orderStatus } from '@/i18n';
import type { OrderStatus } from '@/types';

const BOOKING_WARN_STORAGE = 'table-booking-warn-shown';

function loadBookingWarnShown(): Set<string> {
  try {
    const raw = sessionStorage.getItem(BOOKING_WARN_STORAGE);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveBookingWarnShown(keys: Set<string>) {
  try {
    sessionStorage.setItem(BOOKING_WARN_STORAGE, JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

interface CartLine {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  sale_unit: ProductSaleUnit;
}

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category_id: string;
  sale_unit?: ProductSaleUnit;
  image_url?: string | null;
  categories?: { name: string } | null;
};

type CreateOrderPageProps = {
  orderId?: string;
};

export function CreateOrderPage({ orderId }: CreateOrderPageProps = {}) {
  const isEdit = Boolean(orderId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const notify = useNotificationStore((s) => s.add);
  const isWaiterUser = profile?.role && isWaiter(profile.role);
  const isManagerUser = Boolean(profile?.role && isManager(profile.role));
  const isCashierUser = profile?.role && isCashier(profile.role);
  const [tableId, setTableId] = useState(searchParams.get('table') ?? '');
  const [staffId, setStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [baseline, setBaseline] = useState<DraftOrderLine[]>([]);
  const [draft, setDraft] = useState<DraftOrderLine[]>([]);
  const [weightModal, setWeightModal] = useState<{ product: ProductRow } | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const { data: order, isLoading: loadingOrder } = useOrder(isEdit ? orderId : undefined);
  const { data: serviceRate, isLoading: serviceRateLoading } = useServiceChargeRate();
  const resolvedServiceRate = serviceRate ?? (serviceRateLoading ? DEFAULT_SERVICE_FEE_RATE : 0);
  const { data: products, isLoading: loadingProducts } = useProducts(undefined, true);
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: tables, isLoading: loadingTables } = useTables();
  const { data: openOrderTableIds } = useTableIdsWithOpenOrders();
  const { data: bookingsByTable } = useScheduledBookingsByTable();
  const bookingWarnShownRef = useRef<Set<string>>(loadBookingWarnShown());
  const { data: waiters, isLoading: loadingWaiters } = useWaiters();
  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();
  const createOrder = useCreateOrderWithItems();
  const saveItems = useSaveOrderItems();
  const sendKitchen = useSendToKitchen();
  const closeOrder = useCloseOrder();
  const mayPayRole = canOperateCashRegister(profile?.role);
  const ownsOrder =
    !isEdit ||
    !isWaiterUser ||
    (myStaffId != null && (order as { staff_id?: string | null } | undefined)?.staff_id === myStaffId);
  const viewOnly = Boolean(isEdit && isWaiterUser && order && !ownsOrder);
  const isCashierBlockedByAnotherKassa = Boolean(
    !isEdit &&
      isCashierUser &&
      openKassa &&
      !(
        (openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)
      ),
  );

  useEffect(() => {
    if (!isEdit || !order) return;
    const lines = serverLinesToDraft((order.order_items ?? []) as ServerOrderLine[]);
    setBaseline(lines);
    setDraft(lines);
  }, [isEdit, order?.id, order?.updated_at]);

  const availableTables = useMemo(
    () => (tables ?? []).filter((tbl) => isTableAvailableForNewOrder(tbl, openOrderTableIds)),
    [tables, openOrderTableIds],
  );

  useEffect(() => {
    if (isEdit || isCashierUser) {
      if (isCashierUser && !isEdit) setTableId('');
      return;
    }
    const tbl = searchParams.get('table');
    if (!tbl) return;
    if (!tables) return;
    const selected = tables.find((t) => t.id === tbl);
    if (selected && isTableAvailableForNewOrder(selected, openOrderTableIds)) {
      setTableId(tbl);
      return;
    }
    if (selected && !isTableAvailableForNewOrder(selected, openOrderTableIds)) {
      setTableId('');
      notify({
        type: 'warning',
        title: t('orders.tableOccupiedCannotOrder'),
      });
    }
  }, [isEdit, isCashierUser, searchParams, tables, openOrderTableIds, notify]);

  useEffect(() => {
    if (isEdit || isCashierUser || !tableId || !bookingsByTable) return;
    const booking = bookingsByTable.get(tableId);
    if (!booking) return;
    const key = `${tableId}:${booking.id}`;
    if (bookingWarnShownRef.current.has(key)) return;
    bookingWarnShownRef.current.add(key);
    saveBookingWarnShown(bookingWarnShownRef.current);
    const warn = getTableBookingWarning(booking);
    notify({ type: 'warning', title: warn.title, message: warn.message });
  }, [isEdit, isCashierUser, tableId, bookingsByTable, notify]);

  const activeWaiters = useMemo(
    () => (waiters ?? []).filter((w) => w.status === 'ACTIVE'),
    [waiters],
  );

  useEffect(() => {
    if (isEdit || !isManagerUser || activeWaiters.length === 0) return;
    setStaffId((current) => {
      if (current && activeWaiters.some((w) => w.id === current)) return current;
      return activeWaiters[0].id;
    });
  }, [isEdit, isManagerUser, activeWaiters]);

  const productList = (products as ProductRow[] | undefined) ?? [];

  const productsById = useMemo(
    () => new Map(productList.map((p) => [p.id, p])),
    [productList],
  );

  const displayCart: ComposerCartLine[] = useMemo(
    () => (isEdit ? draftToCart(draft, productsById) : cart),
    [isEdit, draft, cart, productsById],
  );

  const dirty = useMemo(
    () => (isEdit ? isDraftDirty(baseline, draft) : cart.length > 0),
    [isEdit, baseline, draft, cart.length],
  );

  const stockOf = useCallback(
    (productId: string) => productsById.get(productId)?.stock_quantity ?? 0,
    [productsById],
  );

  const notified = t('orders.managerNotifiedShort');

  const notifyShortage = async (productId: string, name: string, requested: number, available: number) => {
    try {
      await reportStockShortage(productId, requested, available);
    } catch {
      /* alert row optional if migration missing */
    }
    notify({
      type: 'error',
      title: t('orders.notEnoughStock'),
      message: t('orders.stockAskedFor', { name, available, requested, notified }),
    });
  };

  const setProductQty = async (p: ProductRow, targetQty: number) => {
    const roundedTarget = roundWeightKg(targetQty);

    if (!isWeightZero(roundedTarget)) {
      const available = stockOf(p.id);
      if (roundedTarget > available + 0.0001) {
        await notifyShortage(p.id, p.name, roundedTarget, available);
        return;
      }
    }

    if (isEdit) {
      const next = applyCartQtyChange(draft, baseline, p.id, roundedTarget, p, isManagerUser);
      if (next === draft && !isManagerUser && roundedTarget < baselineQtyForProduct(baseline, p.id)) {
        notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
        return;
      }
      setDraft(next);
      return;
    }

    const unit: ProductSaleUnit = p.sale_unit ?? 'PIECE';
    if (isWeightZero(roundedTarget)) {
      setCart((prev) => prev.filter((x) => x.product_id !== p.id));
      return;
    }

    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      if (existing) {
        return prev.map((x) =>
          x.product_id === p.id ? { ...x, quantity: roundedTarget } : x,
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          price: Number(p.price),
          quantity: roundedTarget,
          sale_unit: unit,
        },
      ];
    });
  };

  const tryAddToCart = async (p: ProductRow, addQty = 1) => {
    const inCart = cartQtyForProduct(displayCart, p.id);
    await setProductQty(p, roundWeightKg(inCart + addQty));
  };

  const removeFromCart = async (p: ProductRow, removeQty = 1) => {
    const inCart = cartQtyForProduct(displayCart, p.id);
    await setProductQty(p, roundWeightKg(inCart - removeQty));
  };

  const setCartWeight = async (p: ProductRow, totalKg: number) => {
    await setProductQty(p, totalKg);
  };

  const updateQty = async (productId: string, delta: number) => {
    const p = productsById.get(productId);
    const line = displayCart.find((x) => x.product_id === productId);
    if (!p || !line) return;
    await setProductQty(p, roundWeightKg(line.quantity + delta));
  };

  const subtotal = useMemo(
    () => displayCart.reduce((s, l) => s + l.price * l.quantity, 0),
    [displayCart],
  );

  const bill = useMemo((): OrderBill | null => {
    if (!isEdit || !order) return null;
    const rows = draft.map((d) => ({
      id: d.key,
      quantity: d.quantity,
      unit_price: d.unit_price,
      product_name: d.product_name,
      products: {
        name: d.product_name,
        sale_unit: productsById.get(d.product_id)?.sale_unit ?? null,
      },
    }));
    const mealSubtotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
    const tableInfo = order.tables as { charge_type?: string; charge_amount?: number } | null;
    const tableCharge = resolveTableChargeAmount(tableInfo, 1);
    return buildOrderBill(rows, mealSubtotal, resolvedServiceRate, tableCharge);
  }, [isEdit, order, draft, productsById, resolvedServiceRate]);

  const payItems = useMemo(
    () =>
      draft.map((d) => ({
        id: d.id ?? d.key,
        quantity: d.quantity,
        unit_price: d.unit_price,
        products: {
          name: d.product_name,
          sale_unit: productsById.get(d.product_id)?.sale_unit ?? null,
        },
      })),
    [draft, productsById],
  );

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
          ? t('orders.stockWarehouseSingle', { name: first.product_name, available: first.available, notified })
          : t('orders.stockWarehouseMultiple', { n: failures.length, notified }),
    });
  };

  const submitCreate = async (sendToKitchen: boolean) => {
    if (isCashierBlockedByAnotherKassa) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    if (cart.length === 0) {
      notify({ type: 'warning', title: t('orders.addOneProduct') });
      return;
    }
    if (isManagerUser && activeWaiters.length > 0 && !staffId) {
      notify({ type: 'warning', title: t('orders.selectWaiter') });
      return;
    }
    if (isCashierUser && tableId) {
      setTableId('');
    }
    if (!isCashierUser && tableId) {
      const selected = (tables ?? []).find((tbl) => tbl.id === tableId);
      if (!selected || !isTableAvailableForNewOrder(selected, openOrderTableIds)) {
        notify({ type: 'warning', title: t('orders.tableOccupiedCannotOrder') });
        return;
      }
    }
    try {
      await createOrder.mutateAsync({
        table_id: isCashierUser ? undefined : tableId || undefined,
        staff_id: staffId || undefined,
        notes: notes || undefined,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
        sendToKitchen,
      });
      notify({
        type: 'success',
        title: sendToKitchen ? t('orders.orderSentKitchen') : t('orders.orderSavedDraft'),
      });
      navigate('/orders');
    } catch (err) {
      const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
      if (stockFailures?.length) {
        await handleStockFailures(stockFailures);
        return;
      }
      notify({ type: 'error', title: t('orders.failed'), message: getErrorMessage(err) });
    }
  };

  const submitEdit = async () => {
    if (viewOnly || !orderId || !dirty) return;
    if (!isManagerUser && !validateOrderItemEditsForWaiter(baseline, draft)) {
      notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
      return;
    }
    try {
      await saveItems.mutateAsync({ orderId, original: baseline, draft });
      notify({ type: 'success', title: t('orderDetail.saved') });
      navigate('/orders');
    } catch (err) {
      const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
      if (stockFailures?.length) {
        await handleStockFailures(stockFailures);
        return;
      }
      if (getErrorMessage(err) === 'ITEM_IN_KITCHEN' || (err as Error).message === 'ITEM_IN_KITCHEN') {
        notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
        return;
      }
      notify({ type: 'error', title: t('orderDetail.updateFailed'), message: getErrorMessage(err) });
    }
  };

  const isKassaOwnerEdit = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );

  const handleOpenPay = () => {
    if (viewOnly) return;
    if (dirty) {
      notify({ type: 'warning', title: t('orderDetail.unsaved') });
      return;
    }
    if (!openKassa) {
      notify({ type: 'warning', title: t('kassa.mustOpenFirst') });
      return;
    }
    if (!isKassaOwnerEdit) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    setPayOpen(true);
  };

  const handlePrintCheck = (checkBill: OrderBill) => {
    if (!order) return;
    const tableName = getTableName(order, t('common.takeaway'));
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
            getTableName(order, t('common.takeaway')),
            restaurantFromProfile(profile?.restaurants),
            payments,
            new Date(),
            paidBill,
          );
          setPayOpen(false);
          navigate('/orders');
        },
        onError: (err) =>
          notify({ type: 'error', title: t('orders.paymentFailed'), message: getErrorMessage(err) }),
      },
    );
  };

  const submitEditAndSendKitchen = async () => {
    if (viewOnly || !orderId || !order) return;
    try {
      if (dirty) {
        if (!isManagerUser && !validateOrderItemEditsForWaiter(baseline, draft)) {
          notify({ type: 'warning', title: t('orderDetail.existingItemLocked') });
          return;
        }
        await saveItems.mutateAsync({ orderId, original: baseline, draft });
      }
      await sendKitchen.mutateAsync(orderId);
      notify({ type: 'success', title: t('orders.orderSentKitchen') });
      navigate('/orders');
    } catch (err) {
      const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
      if (stockFailures?.length) {
        await handleStockFailures(stockFailures);
        return;
      }
      notify({ type: 'error', title: t('orders.failed'), message: getErrorMessage(err) });
    }
  };

  if (
    loadingProducts ||
    loadingCategories ||
    (isEdit && loadingOrder) ||
    (!isEdit && (loadingTables || loadingWaiters))
  ) {
    return <Spinner />;
  }

  if (isEdit && (!order || !canEditOrderItems(order.status as OrderStatus))) {
    navigate('/orders', { replace: true });
    return null;
  }

  const waiterOptions = activeWaiters.map((w) => ({ value: w.id, label: w.name }));

  const tableOptions = [
    { value: '', label: t('orders.takeawayNoTable') },
    ...availableTables.map((tbl) => ({
      value: tbl.id,
      label: t('orders.tableOption', {
        name: tbl.name,
        status: tableStatus(tbl.status),
        n: tbl.capacity,
      }),
    })),
  ];

  const openWeightModal = (productId: string) => {
    const product = productsById.get(productId);
    if (product) setWeightModal({ product });
  };

  const handlePickerAdd = (p: ProductRow) => {
    if (isWeightProduct(p.sale_unit)) openWeightModal(p.id);
    else void tryAddToCart(p, 1);
  };

  const handlePickerRemove = (p: ProductRow) => {
    if (isWeightProduct(p.sale_unit)) openWeightModal(p.id);
    else void removeFromCart(p, 1);
  };

  const cartQtyBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  const canShowPay = Boolean(
    isEdit && mayPayRole && order && canPayOrder(order.status as OrderStatus),
  );

  const editCartActions = (
    <>
      <Button
        className="w-full"
        disabled={!dirty}
        loading={saveItems.isPending}
        onClick={() => void submitEdit()}
      >
        {t('common.save')}
      </Button>
      {order?.status === 'DRAFT' && (
        <Button
          variant="secondary"
          className="w-full"
          loading={sendKitchen.isPending}
          onClick={() => void submitEditAndSendKitchen()}
        >
          {t('orders.sendToKitchen')}
        </Button>
      )}
      {canShowPay && (
        <>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!bill || dirty}
            onClick={() => bill && handlePrintCheck(bill)}
          >
            {t('payModal.printCheck')}
          </Button>
          <Button
            className="w-full"
            disabled={dirty || Boolean(openKassa && !isKassaOwnerEdit)}
            onClick={handleOpenPay}
          >
            {t('orders.pay')}
          </Button>
        </>
      )}
    </>
  );

  const cartPanel = (options: { showActions: boolean; className?: string }) => (
    <Card className={cn('space-y-4', options.className)}>
      <h3 className="font-semibold">{t('orders.cart')}</h3>
      {displayCart.length === 0 ? (
        <p className="text-sm text-slate-500">{t('orders.cartEmptyHint')}</p>
      ) : (
        <ul className="space-y-3">
          {displayCart.map((line) => {
            const byWeight = isWeightProduct(line.sale_unit);
            const canDecrease = canDecreaseCartQty(baseline, line.product_id, line.quantity, isManagerUser);
            return (
              <li key={line.product_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatSaleQuantity(line.quantity, line.sale_unit)} × {formatCurrency(line.price)}
                    {byWeight ? ' / кг' : ` ${t('orders.each')}`}
                  </p>
                </div>
                {viewOnly ? (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatSaleQuantity(line.quantity, line.sale_unit)}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={cartQtyBtn}
                      disabled={!canDecrease}
                      onClick={() => {
                        if (byWeight) openWeightModal(line.product_id);
                        else void updateQty(line.product_id, -1);
                      }}
                      aria-label={t('orderDetail.decreaseQty')}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2.75rem] text-center text-xs font-semibold tabular-nums">
                      {formatSaleQuantity(line.quantity, line.sale_unit)}
                    </span>
                    <button
                      type="button"
                      className={cn(
                        cartQtyBtn,
                        'border-primary-400 text-primary-600 hover:bg-primary-50 dark:border-primary-500 dark:text-primary-400 dark:hover:bg-primary-950/50',
                      )}
                      onClick={() => {
                        if (byWeight) openWeightModal(line.product_id);
                        else void updateQty(line.product_id, 1);
                      }}
                      aria-label={byWeight ? t('orders.weightAddShort') : t('orderDetail.increaseQty')}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {displayCart.length > 0 && (
        <>
          <hr className="border-slate-200 dark:border-slate-700" />
          <div className="flex justify-between font-bold">
            <span>{t('orders.subtotal')}</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
        </>
      )}
      {options.showActions && !viewOnly && (
        <>
          <p className="text-xs text-slate-500">{t('orders.stockHint')}</p>
          <div className="flex flex-col gap-2 lg:flex-col">
            {isEdit ? (
              editCartActions
            ) : (
              <>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={cart.length === 0 || isCashierBlockedByAnotherKassa}
                  loading={createOrder.isPending}
                  onClick={() => submitCreate(false)}
                >
                  {t('orders.saveDraft')}
                </Button>
                <Button
                  className="w-full"
                  disabled={cart.length === 0 || isCashierBlockedByAnotherKassa}
                  loading={createOrder.isPending}
                  onClick={() => submitCreate(true)}
                >
                  {t('orders.sendToKitchen')}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );

  const mobileCartActions =
    displayCart.length > 0 && !viewOnly ? (
      <div className="fixed-bottom-bar space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t('orders.subtotal')}</span>
          <span className="font-bold tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-xs text-slate-500">{t('orders.stockHint')}</p>
        <div
          className={cn(
            'grid gap-2',
            isEdit && (order?.status === 'DRAFT' || canShowPay) ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {isEdit ? (
            editCartActions
          ) : (
            <>
              <Button
                variant="secondary"
                className="w-full"
                disabled={cart.length === 0 || isCashierBlockedByAnotherKassa}
                loading={createOrder.isPending}
                onClick={() => submitCreate(false)}
              >
                {t('orders.saveDraft')}
              </Button>
              <Button
                className="w-full"
                disabled={cart.length === 0 || isCashierBlockedByAnotherKassa}
                loading={createOrder.isPending}
                onClick={() => submitCreate(true)}
              >
                {t('orders.sendToKitchen')}
              </Button>
            </>
          )}
        </div>
      </div>
    ) : null;

  const pageTitle = isEdit && order
    ? viewOnly
      ? t('orders.viewOrderTitle', { n: order.order_number })
      : t('orders.editOrder', { n: order.order_number })
    : t('orders.newOrderTitle');

  return (
    <div className={cn('page-stack', displayCart.length > 0 && 'pb-44 lg:pb-0')}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Button>
        <h2 className="page-title">{pageTitle}</h2>
        {isEdit && order && (
          <Badge color="blue" size="sm">
            {orderStatus(order.status as OrderStatus)}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          {isEdit && (
            <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              {viewOnly
                ? t('orders.viewOnlyNotice')
                : isManagerUser
                  ? t('orderDetail.editHintManager')
                  : t('orderDetail.editHintWaiter')}
            </p>
          )}

          <Card className="space-y-4">
            {!isEdit && isCashierBlockedByAnotherKassa && (
              <p className="text-sm text-amber-600">{t('kassa.openedByAnotherCashier')}</p>
            )}
            {isEdit && order ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t('orders.table')}</dt>
                  <dd className="font-medium">{getTableName(order, t('common.takeaway'))}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('orders.waiter')}</dt>
                  <dd className="font-medium">{getWaiterName(order)}</dd>
                </div>
                {order.notes && (
                  <div className="col-span-2">
                    <dt className="text-slate-500">{t('orders.orderNotes')}</dt>
                    <dd className="font-medium">{order.notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <>
                {isCashierUser ? (
                  <p className="text-sm text-slate-500">{t('orders.cashierTakeawayOnly')}</p>
                ) : (
                  <Select
                    label={t('orders.table')}
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    options={tableOptions}
                  />
                )}
                {isManagerUser && waiterOptions.length > 0 && (
                  <Select
                    label={t('orders.waiter')}
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    options={waiterOptions}
                    required
                  />
                )}
                {isManagerUser && waiterOptions.length === 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{t('orders.noWaiters')}</p>
                )}
                {isWaiterUser && <p className="text-sm text-slate-500">{t('orders.assignedToYou')}</p>}
                <Input
                  label={t('orders.orderNotes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('orders.orderNotesPlaceholder')}
                />
              </>
            )}
          </Card>

          {!viewOnly && (
            <OrderProductPicker
              products={productList}
              categories={categories}
              cart={displayCart}
              onAdd={handlePickerAdd}
              onRemove={handlePickerRemove}
              minCartQty={
                isEdit && !isManagerUser
                  ? (productId) => baselineQtyForProduct(baseline, productId)
                  : undefined
              }
            />
          )}

          {weightModal && (
            <WeightEntryModal
              open
              productName={weightModal.product.name}
              pricePerKg={Number(weightModal.product.price)}
              inCartKg={cartQtyForProduct(displayCart, weightModal.product.id)}
              maxKg={weightModal.product.stock_quantity}
              onClose={() => setWeightModal(null)}
              onConfirm={(kg) => {
                void setCartWeight(weightModal.product, kg);
                setWeightModal(null);
              }}
            />
          )}

          {cartPanel({ showActions: false, className: 'lg:hidden' })}
        </div>

        {cartPanel({
          showActions: true,
          className: 'hidden h-fit space-y-4 lg:sticky lg:top-6 lg:block',
        })}
      </div>
      {mobileCartActions}

      {isEdit && order && bill && (
        <PayOrderModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          orderNumber={order.order_number}
          tableName={getTableName(order, t('common.takeaway'))}
          table={order.tables as { charge_type?: string; charge_amount?: number } | null}
          items={payItems}
          subtotal={bill.mealSubtotal}
          startedAt={order.created_at}
          loading={closeOrder.isPending}
          onConfirm={confirmPay}
          onPrintCheck={handlePrintCheck}
          disablePrintCheck={dirty}
        />
      )}
    </div>
  );
}
