import { useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, Search } from 'lucide-react';
import { MenuImage } from '@/components/ui/MenuImage';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import { cartQtyForProduct } from '@/lib/stock';
import { formatSaleQuantity, isWeightProduct, roundWeightKg, type ProductSaleUnit } from '@/lib/weight';
import { t } from '@/i18n';

export type OrderProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category_id: string;
  sale_unit?: ProductSaleUnit;
  image_url?: string | null;
  categories?: { name: string } | null;
};

export type OrderCategoryRow = {
  id: string;
  name: string;
  image_url?: string | null;
  is_active?: boolean;
};

type CartLine = { product_id: string; quantity: number };

type OrderProductPickerProps = {
  products: OrderProductRow[];
  categories: OrderCategoryRow[];
  cart: CartLine[];
  onAdd: (product: OrderProductRow, quantity?: number) => void;
  onRemove: (product: OrderProductRow, quantity?: number) => void;
  /** Minimum cart qty per product (e.g. saved order baseline for waiters). */
  minCartQty?: (productId: string) => number;
};

export function OrderProductPicker({ products, categories, cart, onAdd, onRemove, minCartQty }: OrderProductPickerProps) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const searchTrim = search.trim();
  const isSearching = searchTrim.length > 0;

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active !== false),
    [categories],
  );

  const productsByCategory = useMemo(() => {
    const map = new Map<string, OrderProductRow[]>();
    for (const p of products) {
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return map;
  }, [products]);

  const categoriesWithProducts = useMemo(
    () =>
      activeCategories
        .map((cat) => ({
          ...cat,
          count: productsByCategory.get(cat.id)?.length ?? 0,
        }))
        .filter((cat) => cat.count > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeCategories, productsByCategory],
  );

  const selectedCategory = useMemo(
    () => (categoryId ? categoriesWithProducts.find((c) => c.id === categoryId) ?? null : null),
    [categoryId, categoriesWithProducts],
  );

  const visibleProducts = useMemo(() => {
    const list = isSearching
      ? products.filter((p) => p.name.toLowerCase().includes(searchTrim.toLowerCase()))
      : categoryId
        ? productsByCategory.get(categoryId) ?? []
        : [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [isSearching, searchTrim, categoryId, products, productsByCategory]);

  const showCategories = !isSearching && !categoryId;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder={t('orders.searchMeals')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isSearching && (
        <p className="text-sm text-slate-500">
          {visibleProducts.length > 0
            ? t('orders.searchResults', { n: visibleProducts.length })
            : t('orders.noProductsForOrder')}
        </p>
      )}

      {showCategories && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('orders.selectCategory')}
          </p>
          {categoriesWithProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              {t('orders.noProductsForOrder')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {categoriesWithProducts.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left',
                    'transition hover:border-primary-300 active:scale-[0.98]',
                    'dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-600',
                  )}
                >
                  <div className="h-16 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <MenuImage
                      src={cat.image_url}
                      alt={cat.name}
                      className="!h-full !w-full !rounded-none object-cover"
                      size="sm"
                    />
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-semibold leading-tight">{cat.name}</p>
                    <p className="text-[11px] text-slate-500">{t('qr.itemCount', { n: cat.count })}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!showCategories && !isSearching && selectedCategory && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryId(null)}>
            <ArrowLeft className="h-4 w-4" />
            {t('orders.backToCategories')}
          </Button>
          <span className="truncate text-sm font-semibold">{selectedCategory.name}</span>
        </div>
      )}

      {!showCategories && (
        <ProductCardGrid
          products={visibleProducts}
          cart={cart}
          onAdd={onAdd}
          onRemove={onRemove}
          minCartQty={minCartQty}
        />
      )}
    </div>
  );
}

function ProductCardGrid({
  products,
  cart,
  onAdd,
  onRemove,
  minCartQty,
}: {
  products: OrderProductRow[];
  cart: CartLine[];
  onAdd: (product: OrderProductRow) => void;
  onRemove: (product: OrderProductRow) => void;
  minCartQty?: (productId: string) => number;
}) {
  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
        {t('orders.noProductsForOrder')}
      </p>
    );
  }

  const iconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-medium transition active:scale-95 disabled:opacity-40';

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => {
        const inCart = cartQtyForProduct(cart, p.id);
        const byWeight = isWeightProduct(p.sale_unit);
        const outOfStock = p.stock_quantity <= 0;
        const remaining = roundWeightKg(p.stock_quantity - inCart);
        const atLimit = byWeight ? remaining < 0.001 : inCart >= p.stock_quantity && p.stock_quantity > 0;
        const cartLabel = inCart > 0 ? formatSaleQuantity(inCart, byWeight ? 'KG' : 'PIECE') : null;
        const minQty = minCartQty?.(p.id) ?? 0;
        const canDecrease = inCart > minQty + 0.0001;

        return (
          <div
            key={p.id}
            className={cn(
              'flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
              outOfStock && 'opacity-50',
            )}
          >
            <div className="flex gap-2 p-2">
              <MenuImage
                src={p.image_url}
                alt={p.name}
                size="sm"
                className="!h-11 !w-11 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-tight">{p.name}</p>
                <p className="text-xs font-bold tabular-nums text-primary-600 dark:text-primary-400">
                  {formatCurrency(Number(p.price))}
                  {byWeight && <span className="font-normal text-slate-500"> / кг</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-2 py-2 dark:border-slate-800">
              <button
                type="button"
                disabled={!canDecrease}
                onClick={() => onRemove(p)}
                className={cn(
                  iconBtn,
                  'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                )}
                aria-label={t('orderDetail.decreaseQty')}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-[11px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
                {cartLabel ?? '—'}
              </span>
              <button
                type="button"
                disabled={outOfStock || atLimit}
                onClick={() => onAdd(p)}
                className={cn(
                  iconBtn,
                  'border-primary-400 text-primary-600 hover:bg-primary-50 dark:border-primary-500 dark:text-primary-400 dark:hover:bg-primary-950/50',
                )}
                aria-label={byWeight ? t('orders.weightAddShort') : t('orders.addToCart')}
                title={byWeight ? t('orders.weightAddShort') : t('orders.addToCart')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
