import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { MenuImage } from '@/components/ui/MenuImage';
import { ImageUrlField } from '@/components/ui/ImageUrlField';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import {
  useProducts,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUpsertCategory,
  useDeleteCategory,
  useToggleCategory,
} from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantId } from '@/contexts/AuthContext';
import { isManager } from '@/lib/roles';
import { cn, formatCurrency } from '@/lib/utils';
import { formatSaleQuantity } from '@/lib/weight';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { useWarehouseProductIds } from '@/hooks/useInventory';
import { CategoryCardMenu } from '@/components/menu/CategoryCardMenu';
import { t } from '@/i18n';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  image_url?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  image_url: string | null;
  category_id: string;
  cost_price?: number | null;
  categories: { name: string } | null;
  sale_unit?: 'PIECE' | 'KG';
};

export function MenuPage() {
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const canEdit = profile?.role && isManager(profile.role);
  const [search, setSearch] = useState('');
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);

  const { data: products = [], isFetching, isError, error, refetch } = useProducts(
    search || undefined,
    !canEdit,
  );
  const { data: categories = [], isFetching: loadingCategories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const upsertCategory = useUpsertCategory();
  const deleteCategory = useDeleteCategory();
  const toggleCategory = useToggleCategory();
  const { data: warehouseProductIds } = useWarehouseProductIds();
  const notify = useNotificationStore((s) => s.add);

  const [productOpen, setProductOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);

  const [pName, setPName] = useState('');
  const [pCategoryId, setPCategoryId] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCost, setPCost] = useState('');
  const [pStock, setPStock] = useState('0');
  const [pSaleUnit, setPSaleUnit] = useState<'PIECE' | 'KG'>('PIECE');
  const [pImage, setPImage] = useState('');
  const [pActive, setPActive] = useState(true);

  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cImage, setCImage] = useState('');

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const productList = products as ProductRow[];

  const categoriesWithCounts = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        count: productList.filter((p) => p.category_id === cat.id).length,
      })),
    [categories, productList],
  );

  const selectedMenuCategory = useMemo(
    () => (menuCategoryId ? categoriesWithCounts.find((c) => c.id === menuCategoryId) ?? null : null),
    [menuCategoryId, categoriesWithCounts],
  );

  const searchTrim = search.trim();
  const isSearching = searchTrim.length > 0;
  const showCategoryGrid = !isSearching && !menuCategoryId;

  const visibleProducts = useMemo(() => {
    if (isSearching) {
      const q = searchTrim.toLowerCase();
      return productList.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (menuCategoryId) {
      return productList.filter((p) => p.category_id === menuCategoryId);
    }
    return [];
  }, [productList, isSearching, searchTrim, menuCategoryId]);

  const editingWarehouseProduct = Boolean(editProductId && warehouseProductIds?.has(editProductId));

  if (profile?.role !== 'SUPER_ADMIN' && !restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('menu.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  const resetProductForm = () => {
    setEditProductId(null);
    setPName('');
    setPCategoryId('');
    setPPrice('');
    setPCost('');
    setPStock('0');
    setPSaleUnit('PIECE');
    setPImage('');
    setPActive(true);
  };

  const openNewProduct = () => {
    if (categoryOptions.length === 0) {
      notify({ type: 'warning', title: t('menu.addCategoryFirst') });
      return;
    }
    resetProductForm();
    if (menuCategoryId) setPCategoryId(menuCategoryId);
    setProductOpen(true);
  };

  const openEditProduct = (p: ProductRow) => {
    setEditProductId(p.id);
    setPName(p.name);
    setPCategoryId(p.category_id);
    setPPrice(String(p.price));
    setPCost(p.cost_price != null ? String(p.cost_price) : '');
    setPStock(String(p.stock_quantity));
    setPSaleUnit((p as ProductRow).sale_unit ?? 'PIECE');
    setPImage(p.image_url ?? '');
    setPActive(p.is_active);
    setProductOpen(true);
  };

  const resetCategoryForm = () => {
    setEditCategoryId(null);
    setCName('');
    setCDesc('');
    setCImage('');
  };

  const openNewCategory = () => {
    resetCategoryForm();
    setCategoryOpen(true);
  };

  const openEditCategory = (cat: CategoryRow) => {
    setEditCategoryId(cat.id);
    setCName(cat.name);
    setCDesc(cat.description ?? '');
    setCImage(cat.image_url ?? '');
    setCategoryOpen(true);
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pCategoryId) {
      notify({ type: 'error', title: t('menu.selectCategory') });
      return;
    }
    if (!editingWarehouseProduct && !pPrice.trim()) {
      notify({ type: 'error', title: t('menu.price') });
      return;
    }
    const payload: {
      name: string;
      category_id: string;
      image_url?: string;
      stock_quantity: number;
      sale_unit: 'PIECE' | 'KG';
      price?: number;
      cost_price?: number;
      is_active?: boolean;
    } = {
      name: pName,
      category_id: pCategoryId,
      image_url: pImage || undefined,
      stock_quantity: parseFloat(pStock) || 0,
      sale_unit: pSaleUnit,
    };
    if (!editingWarehouseProduct) {
      payload.price = parseFloat(pPrice);
      payload.cost_price = pCost ? parseFloat(pCost) : 0;
      payload.is_active = pActive;
    }
    try {
      if (editProductId) {
        await updateProduct.mutateAsync({ id: editProductId, ...payload });
        notify({ type: 'success', title: t('menu.productUpdated') });
      } else {
        await createProduct.mutateAsync({
          name: payload.name,
          category_id: payload.category_id,
          price: parseFloat(pPrice),
          cost_price: payload.cost_price ?? 0,
          image_url: payload.image_url,
          stock_quantity: payload.stock_quantity,
          sale_unit: payload.sale_unit,
          is_active: pActive,
          tax_rate: 10,
        });
        notify({ type: 'success', title: t('menu.productAdded') });
      }
      setProductOpen(false);
      resetProductForm();
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertCategory.mutateAsync({
        id: editCategoryId ?? undefined,
        name: cName,
        description: cDesc || undefined,
        image_url: cImage || undefined,
      });
      notify({
        type: 'success',
        title: editCategoryId ? t('menu.categoryUpdated') : t('menu.categoryAdded'),
      });
      setCategoryOpen(false);
      resetCategoryForm();
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const handleDeleteProduct = (p: ProductRow) => {
    if (!window.confirm(t('menu.deleteProductConfirm', { name: p.name }))) return;
    deleteProduct.mutate(p.id, {
      onSuccess: () => notify({ type: 'success', title: t('menu.productDeleted') }),
      onError: (err) =>
        notify({
          type: 'error',
          title: t('menu.cannotDeleteProduct'),
          message: getErrorMessage(err),
        }),
    });
  };

  const handleDeleteCategory = (cat: CategoryRow) => {
    if (!window.confirm(t('menu.deleteCategoryConfirm', { name: cat.name }))) {
      return;
    }
    deleteCategory.mutate(cat.id, {
      onSuccess: () => {
        if (menuCategoryId === cat.id) setMenuCategoryId(null);
        notify({ type: 'success', title: t('menu.categoryDeleted') });
      },
      onError: (err) =>
        notify({
          type: 'error',
          title: t('menu.cannotDeleteCategory'),
          message: getErrorMessage(err),
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('menu.title')}</h2>
          <p className="text-sm text-slate-500">{t('menu.subtitle')}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openNewCategory}>
              <Plus className="h-4 w-4" /> {t('menu.categoryBtn')}
            </Button>
            <Button onClick={openNewProduct}>
              <Plus className="h-4 w-4" /> {t('menu.productBtn')}
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder={t('menu.searchProducts')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{t('menu.products')}</h3>
          <Badge color="blue" size="sm">{products.length}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {canEdit ? t('menu.productsDescEdit') : t('menu.productsDescBrowse')}
        </p>
        {isError && <p className="mb-3 text-sm text-red-600">{getErrorMessage(error)}</p>}
        {isFetching || loadingCategories ? (
          <Spinner />
        ) : products.length === 0 && categories.length === 0 && !isSearching ? (
          <EmptyState title={t('menu.noProducts')} description={t('menu.noProductsDesc')} />
        ) : (
          <div className="space-y-4">
            {isSearching && (
              <p className="text-sm text-slate-500">
                {visibleProducts.length > 0
                  ? t('orders.searchResults', { n: visibleProducts.length })
                  : t('menu.noProducts')}
              </p>
            )}

            {showCategoryGrid && (
              <div>
                <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t('menu.selectCategoryPrompt')}
                </p>
                {categoriesWithCounts.length === 0 ? (
                  <EmptyState title={t('menu.noCategories')} description={t('menu.noCategoriesDesc')} />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {categoriesWithCounts.map((cat) => (
                      <div key={cat.id} className="relative">
                        {canEdit && (
                          <div className="absolute right-1.5 top-1.5 z-10">
                            <CategoryCardMenu
                              isActive={cat.is_active}
                              onEdit={() => openEditCategory(cat as CategoryRow)}
                              onToggleActive={() =>
                                toggleCategory.mutate({ id: cat.id, is_active: !cat.is_active })
                              }
                              onDelete={() => handleDeleteCategory(cat as CategoryRow)}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setMenuCategoryId(cat.id)}
                          className={cn(
                            'flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left',
                            'transition hover:border-primary-300 active:scale-[0.98]',
                            'dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-600',
                            !cat.is_active && 'opacity-60',
                          )}
                        >
                          <div className="h-16 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <MenuImage
                              src={(cat as CategoryRow).image_url}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!showCategoryGrid && !isSearching && selectedMenuCategory && (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMenuCategoryId(null)}>
                  <ArrowLeft className="h-4 w-4" />
                  {t('menu.backToCategories')}
                </Button>
                <span className="truncate text-sm font-semibold">{selectedMenuCategory.name}</span>
              </div>
            )}

            {!showCategoryGrid && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleProducts.length === 0 ? (
                  <p className="col-span-full rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                    {t('menu.noProducts')}
                  </p>
                ) : (
                  visibleProducts.map((p) => {
                    const fromWarehouse = warehouseProductIds?.has(p.id);
                    const byWeight = p.sale_unit === 'KG';
                    const stockLabel = formatSaleQuantity(p.stock_quantity, byWeight ? 'KG' : 'PIECE');
                    return (
                      <div
                        key={p.id}
                        className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
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
                            <p className="text-[11px] text-slate-500">
                              {t('menu.stock')}: {stockLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-2 dark:border-slate-800">
                          <Badge color={p.is_active ? 'green' : 'gray'} size="sm">
                            {p.is_active ? t('common.active') : t('common.inactive')}
                          </Badge>
                          {fromWarehouse && (
                            <Badge color="blue" size="sm">
                              {t('menu.warehouseBadge')}
                            </Badge>
                          )}
                          {canEdit && (
                            <div className="ml-auto flex items-center gap-0.5">
                              {!fromWarehouse && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0 px-0"
                                  onClick={() =>
                                    updateProduct.mutate({ id: p.id, is_active: !p.is_active })
                                  }
                                  title={p.is_active ? t('common.off') : t('common.on')}
                                >
                                  {p.is_active ? t('common.off') : t('common.on')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 px-0"
                                onClick={() => openEditProduct(p)}
                                title={t('common.edit')}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 px-0"
                                onClick={() => handleDeleteProduct(p)}
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
        {isError && (
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        )}
      </section>

      {canEdit && (
        <>
          <Modal
            open={productOpen}
            onClose={() => {
              setProductOpen(false);
              resetProductForm();
            }}
            title={editProductId ? t('menu.editProduct') : t('menu.newProduct')}
          >
            <form onSubmit={submitProduct} className="space-y-4">
              <ImageUrlField
                label={t('menu.productImage')}
                value={pImage}
                onChange={setPImage}
                previewAlt={pName || t('menu.productPreview')}
              />
              <Input label={t('common.name')} value={pName} onChange={(e) => setPName(e.target.value)} required />
              <Select
                label={t('menu.category')}
                value={pCategoryId}
                onChange={(e) => setPCategoryId(e.target.value)}
                options={categoryOptions}
                required
              />
              <Select
                label={t('menu.saleUnit')}
                value={pSaleUnit}
                onChange={(e) => setPSaleUnit(e.target.value as 'PIECE' | 'KG')}
                options={[
                  { value: 'PIECE', label: t('menu.saleUnitPiece') },
                  { value: 'KG', label: t('menu.saleUnitKg') },
                ]}
              />
              {editingWarehouseProduct ? (
                <p className="text-sm text-slate-500">{t('menu.warehouseEditHint')}</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label={pSaleUnit === 'KG' ? t('menu.pricePerKgHint') : t('menu.price')}
                      type="number"
                      step="0.01"
                      min="0"
                      value={pPrice}
                      onChange={(e) => setPPrice(e.target.value)}
                      required
                    />
                    <Input
                      label={pSaleUnit === 'KG' ? t('menu.stockKgHint') : t('menu.stockQty')}
                      type="number"
                      step={pSaleUnit === 'KG' ? '0.001' : '1'}
                      min="0"
                      value={pStock}
                      onChange={(e) => setPStock(e.target.value)}
                    />
                  </div>
                  <Input
                    label={t('menu.costPrice')}
                    type="number"
                    step="0.01"
                    min="0"
                    value={pCost}
                    onChange={(e) => setPCost(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pActive}
                      onChange={(e) => setPActive(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    {t('menu.activeOnMenu')}
                  </label>
                </>
              )}
              {editingWarehouseProduct && (
                <Input
                  label={pSaleUnit === 'KG' ? t('menu.stockKgHint') : t('menu.stockQty')}
                  type="number"
                  step={pSaleUnit === 'KG' ? '0.001' : '1'}
                  min="0"
                  value={pStock}
                  onChange={(e) => setPStock(e.target.value)}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setProductOpen(false);
                    resetProductForm();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={createProduct.isPending || updateProduct.isPending}
                >
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={categoryOpen}
            onClose={() => {
              setCategoryOpen(false);
              resetCategoryForm();
            }}
            title={editCategoryId ? t('menu.editCategory') : t('menu.newCategory')}
          >
            <form onSubmit={submitCategory} className="space-y-4">
              <ImageUrlField
                label={t('menu.categoryImage')}
                value={cImage}
                onChange={setCImage}
                previewAlt={cName || t('menu.categoryPreview')}
              />
              <Input label={t('common.name')} value={cName} onChange={(e) => setCName(e.target.value)} required />
              <Input
                label={t('menu.description')}
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCategoryOpen(false);
                    resetCategoryForm();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={upsertCategory.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
