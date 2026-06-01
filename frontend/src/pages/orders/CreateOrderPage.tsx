import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Minus, Plus, Search, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { MenuImage } from '@/components/ui/MenuImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useProducts } from '@/hooks/useProducts';
import { useTables } from '@/hooks/useTables';
import { useWaiters } from '@/hooks/useEmployees';
import { useCreateOrderWithItems } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { isManager, isWaiter } from '@/lib/roles';
import { cn, formatCurrency } from '@/lib/utils';
import { cartQtyForProduct, reportStockShortage, type StockFailure } from '@/lib/stock';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { isTableAvailableForNewOrder } from '@/lib/tableOrder';
import { t, tableStatus } from '@/i18n';

interface CartLine {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url?: string | null;
  categories?: { name: string } | null;
};

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const notify = useNotificationStore((s) => s.add);
  const isWaiterUser = profile?.role && isWaiter(profile.role);
  const isManagerUser = profile?.role && isManager(profile.role);
  const [search, setSearch] = useState('');
  const [tableId, setTableId] = useState(searchParams.get('table') ?? '');
  const [staffId, setStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const { data: products, isLoading: loadingProducts } = useProducts(search || undefined, true);
  const { data: tables, isLoading: loadingTables } = useTables();
  const { data: waiters, isLoading: loadingWaiters } = useWaiters();
  const createOrder = useCreateOrderWithItems();

  const availableTables = useMemo(
    () => (tables ?? []).filter((tbl) => isTableAvailableForNewOrder(tbl)),
    [tables],
  );

  useEffect(() => {
    const tbl = searchParams.get('table');
    if (!tbl) return;
    if (!tables) return;
    const selected = tables.find((t) => t.id === tbl);
    if (selected && isTableAvailableForNewOrder(selected)) {
      setTableId(tbl);
      return;
    }
    if (selected && !isTableAvailableForNewOrder(selected)) {
      setTableId('');
      notify({
        type: 'warning',
        title: t('orders.tableOccupiedCannotOrder'),
      });
    }
  }, [searchParams, tables, notify]);

  const activeWaiters = useMemo(
    () => (waiters ?? []).filter((w) => w.status === 'ACTIVE'),
    [waiters],
  );

  useEffect(() => {
    if (!isManagerUser || activeWaiters.length === 0) return;
    setStaffId((current) => {
      if (current && activeWaiters.some((w) => w.id === current)) return current;
      return activeWaiters[0].id;
    });
  }, [isManagerUser, activeWaiters]);

  const stockOf = useCallback(
    (productId: string) => (products as ProductRow[] | undefined)?.find((p) => p.id === productId)?.stock_quantity ?? 0,
    [products],
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

  const tryAddToCart = async (p: ProductRow) => {
    const inCart = cartQtyForProduct(cart, p.id);
    const available = stockOf(p.id);
    const nextQty = inCart + 1;

    if (nextQty > available) {
      await notifyShortage(p.id, p.name, nextQty, available);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      if (existing) {
        return prev.map((x) => (x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...prev, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
  };

  const updateQty = async (productId: string, delta: number) => {
    const p = (products as ProductRow[] | undefined)?.find((x) => x.id === productId);
    const line = cart.find((x) => x.product_id === productId);
    if (!line) return;

    const nextQty = line.quantity + delta;
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((x) => x.product_id !== productId));
      return;
    }

    const available = stockOf(productId);
    if (nextQty > available) {
      await notifyShortage(productId, p?.name ?? line.name, nextQty, available);
      return;
    }

    setCart((prev) => prev.map((x) => (x.product_id === productId ? { ...x, quantity: nextQty } : x)));
  };

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);

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

  const submit = async (sendToKitchen: boolean) => {
    if (cart.length === 0) {
      notify({ type: 'warning', title: t('orders.addOneProduct') });
      return;
    }
    if (isManagerUser && activeWaiters.length > 0 && !staffId) {
      notify({ type: 'warning', title: t('orders.selectWaiter') });
      return;
    }
    if (tableId) {
      const selected = (tables ?? []).find((tbl) => tbl.id === tableId);
      if (!selected || !isTableAvailableForNewOrder(selected)) {
        notify({ type: 'warning', title: t('orders.tableOccupiedCannotOrder') });
        return;
      }
    }
    try {
      await createOrder.mutateAsync({
        table_id: tableId || undefined,
        staff_id: staffId || undefined,
        notes: notes || undefined,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
        sendToKitchen,
      });
      notify({
        type: 'success',
        title: sendToKitchen ? t('orders.orderSentKitchen') : t('orders.orderSavedDraft'),
        message: tableId ? t('orders.tableOccupied') : undefined,
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

  if (loadingProducts || loadingTables || loadingWaiters) return <Spinner />;

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

  const productList = (products as ProductRow[] | undefined) ?? [];

  const cartPanel = (options: { showActions: boolean; className?: string }) => (
    <Card className={cn('space-y-4', options.className)}>
      <h3 className="font-semibold">{t('orders.cart')}</h3>
      {cart.length === 0 ? (
        <p className="text-sm text-slate-500">{t('orders.cartEmptyHint')}</p>
      ) : (
        <ul className="space-y-3">
          {cart.map((line) => (
            <li key={line.product_id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(line.price)} {t('orders.each')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="touch-target rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void updateQty(line.product_id, -1)}
                  aria-label={t('orderDetail.decreaseQty')}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                <button
                  type="button"
                  className="touch-target rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void updateQty(line.product_id, 1)}
                  aria-label={t('orderDetail.increaseQty')}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {cart.length > 0 && (
        <>
          <hr className="border-slate-200 dark:border-slate-700" />
          <div className="flex justify-between font-bold">
            <span>{t('orders.subtotal')}</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
        </>
      )}
      {options.showActions && (
        <>
          <p className="text-xs text-slate-500">{t('orders.stockHint')}</p>
          <div className="flex flex-col gap-2 lg:flex-col">
            <Button
              variant="secondary"
              className="w-full"
              disabled={cart.length === 0}
              loading={createOrder.isPending}
              onClick={() => submit(false)}
            >
              {t('orders.saveDraft')}
            </Button>
            <Button
              className="w-full"
              disabled={cart.length === 0}
              loading={createOrder.isPending}
              onClick={() => submit(true)}
            >
              {t('orders.sendToKitchen')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );

  const mobileCartActions =
    cart.length > 0 ? (
      <div className="flex flex-col gap-2 lg:hidden">
        <p className="text-xs text-slate-500">{t('orders.stockHint')}</p>
        <Button
          variant="secondary"
          className="w-full"
          disabled={cart.length === 0}
          loading={createOrder.isPending}
          onClick={() => submit(false)}
        >
          {t('orders.saveDraft')}
        </Button>
        <Button
          className="w-full"
          disabled={cart.length === 0}
          loading={createOrder.isPending}
          onClick={() => submit(true)}
        >
          {t('orders.sendToKitchen')}
        </Button>
      </div>
    ) : null;

  return (
    <div className={cn('page-stack', cart.length > 0 && 'pb-4 lg:pb-0')}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Button>
        <h2 className="page-title">{t('orders.newOrderTitle')}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-4">
            <Select label={t('orders.table')} value={tableId} onChange={(e) => setTableId(e.target.value)} options={tableOptions} />
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
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder={t('orders.searchMeals')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ul className="space-y-2 lg:hidden">
            {productList.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                {t('orders.noProductsForOrder')}
              </li>
            ) : null}
            {productList.map((p) => {
              const inCart = cartQtyForProduct(cart, p.id);
              const outOfStock = p.stock_quantity <= 0;
              const atLimit = inCart >= p.stock_quantity && p.stock_quantity > 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <MenuImage src={p.image_url} alt={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.categories?.name} · {formatCurrency(Number(p.price))}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('orders.stockCol')} {p.stock_quantity}
                    </p>
                    {inCart > 0 && (
                      <p className="text-xs font-medium text-primary-600 dark:text-primary-400">
                        {t('orders.inCart', { n: inCart })}
                      </p>
                    )}
                  </div>
                  <Button size="sm" disabled={outOfStock || atLimit} onClick={() => void tryAddToCart(p)}>
                    {t('orders.addToCart')}
                  </Button>
                </li>
              );
            })}
          </ul>

          {cartPanel({ showActions: false, className: 'lg:hidden' })}
          {mobileCartActions}

          <div className="scroll-touch hidden rounded-xl border border-slate-200 dark:border-slate-800 lg:block">
            <table className="table-compact min-w-[560px]">
              <thead>
                <tr>
                  <th>{t('orders.imageCol')}</th>
                  <th>{t('orders.productCol')}</th>
                  <th>{t('orders.categoryCol')}</th>
                  <th>{t('orders.priceCol')}</th>
                  <th>{t('orders.stockCol')}</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {productList.map((p) => {
                  const inCart = cartQtyForProduct(cart, p.id);
                  const outOfStock = p.stock_quantity <= 0;
                  const atLimit = inCart >= p.stock_quantity && p.stock_quantity > 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <MenuImage src={p.image_url} alt={p.name} size="xs" />
                      </td>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-slate-500">{p.categories?.name}</td>
                      <td>{formatCurrency(Number(p.price))}</td>
                      <td>{p.stock_quantity}</td>
                      <td className="text-right">
                        <Button
                          size="sm"
                          disabled={outOfStock || atLimit}
                          onClick={() => void tryAddToCart(p)}
                        >
                          {t('orders.addToCart')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {cartPanel({
          showActions: true,
          className: 'hidden h-fit space-y-4 lg:sticky lg:top-6 lg:block',
        })}
      </div>
    </div>
  );
}
