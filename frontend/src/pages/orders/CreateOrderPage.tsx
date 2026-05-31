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
import { formatCurrency } from '@/lib/utils';
import { cartQtyForProduct, reportStockShortage, type StockFailure } from '@/lib/stock';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

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

  useEffect(() => {
    const t = searchParams.get('table');
    if (t) setTableId(t);
  }, [searchParams]);

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

  const notifyShortage = async (productId: string, name: string, requested: number, available: number) => {
    try {
      await reportStockShortage(productId, requested, available);
    } catch {
      /* alert row optional if migration missing */
    }
    notify({
      type: 'error',
      title: 'Not enough in stock',
      message: `${name}: only ${available} available (you asked for ${requested}). Manager has been notified.`,
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
      title: 'Not enough stock',
      message: failures.length === 1
        ? `${first.product_name}: only ${first.available} in warehouse. Manager notified.`
        : `${failures.length} items are out of stock. Manager notified.`,
    });
  };

  const submit = async (sendToKitchen: boolean) => {
    if (cart.length === 0) {
      notify({ type: 'warning', title: 'Add at least one product' });
      return;
    }
    if (isManagerUser && activeWaiters.length > 0 && !staffId) {
      notify({ type: 'warning', title: 'Select a waiter' });
      return;
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
        title: sendToKitchen ? 'Order sent to kitchen' : 'Order saved as draft',
        message: tableId ? 'Table marked occupied.' : undefined,
      });
      navigate('/orders');
    } catch (err) {
      const stockFailures = (err as Error & { stockFailures?: StockFailure[] }).stockFailures;
      if (stockFailures?.length) {
        await handleStockFailures(stockFailures);
        return;
      }
      notify({ type: 'error', title: 'Failed', message: getErrorMessage(err) });
    }
  };

  if (loadingProducts || loadingTables || loadingWaiters) return <Spinner />;

  const waiterOptions = activeWaiters.map((w) => ({ value: w.id, label: w.name }));

  const tableOptions = [
    { value: '', label: 'Takeaway (no table)' },
    ...(tables ?? []).map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.status} (${t.capacity} seats)`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h2 className="text-2xl font-bold">New order</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-4">
            <Select label="Table" value={tableId} onChange={(e) => setTableId(e.target.value)} options={tableOptions} />
            {isManagerUser && waiterOptions.length > 0 && (
              <Select
                label="Waiter"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                options={waiterOptions}
                required
              />
            )}
            {isManagerUser && waiterOptions.length === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No waiters on staff yet. Add waiters under Staff or send an invite link.
              </p>
            )}
            {isWaiterUser && <p className="text-sm text-slate-500">This order will be assigned to you.</p>}
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, special requests..." />
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search meals & drinks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="table-compact min-w-[560px]">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {(products as ProductRow[] | undefined)?.map((p) => {
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
                          Add
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Card className="h-fit space-y-4 lg:sticky lg:top-6">
          <h3 className="font-semibold">Order cart</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-slate-500">Tap products to add them</p>
          ) : (
            <ul className="space-y-3">
              {cart.map((line) => (
                <li key={line.product_id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(line.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => void updateQty(line.product_id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm">{line.quantity}</span>
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => void updateQty(line.product_id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <hr className="border-slate-200 dark:border-slate-700" />
          <div className="flex justify-between font-bold">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <p className="text-xs text-slate-500">Stock is checked from each product&apos;s quantity (set under Products).</p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" disabled={cart.length === 0} loading={createOrder.isPending} onClick={() => submit(false)}>
              Save draft
            </Button>
            <Button disabled={cart.length === 0} loading={createOrder.isPending} onClick={() => submit(true)}>
              Send to kitchen
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
