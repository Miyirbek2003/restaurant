import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
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
import { formatCurrency } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { useWarehouseProductIds } from '@/hooks/useInventory';
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
  sku: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  image_url: string | null;
  category_id: string;
  cost_price?: number | null;
  categories: { name: string } | null;
};

export function MenuPage() {
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const canEdit = profile?.role && isManager(profile.role);
  const [search, setSearch] = useState('');

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
  const [pSku, setPSku] = useState('');
  const [pCost, setPCost] = useState('');
  const [pStock, setPStock] = useState('0');
  const [pImage, setPImage] = useState('');
  const [pActive, setPActive] = useState(true);

  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cImage, setCImage] = useState('');

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof products>();
    for (const p of products) {
      const cat = (p.categories as { name: string } | null)?.name ?? t('menu.uncategorized');
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [products]);

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
    setPSku('');
    setPCost('');
    setPStock('0');
    setPImage('');
    setPActive(true);
  };

  const openNewProduct = () => {
    if (categoryOptions.length === 0) {
      notify({ type: 'warning', title: t('menu.addCategoryFirst') });
      return;
    }
    resetProductForm();
    setProductOpen(true);
  };

  const openEditProduct = (p: ProductRow) => {
    setEditProductId(p.id);
    setPName(p.name);
    setPCategoryId(p.category_id);
    setPPrice(String(p.price));
    setPSku(p.sku ?? '');
    setPCost(p.cost_price != null ? String(p.cost_price) : '');
    setPStock(String(p.stock_quantity));
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
    const payload = {
      name: pName,
      category_id: pCategoryId,
      price: parseFloat(pPrice),
      sku: pSku || undefined,
      cost_price: pCost ? parseFloat(pCost) : 0,
      image_url: pImage || undefined,
      stock_quantity: parseInt(pStock, 10) || 0,
      is_active: pActive,
    };
    try {
      if (editProductId) {
        await updateProduct.mutateAsync({ id: editProductId, ...payload });
        notify({ type: 'success', title: t('menu.productUpdated') });
      } else {
        await createProduct.mutateAsync({ ...payload, tax_rate: 10, is_active: pActive });
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
      onSuccess: () => notify({ type: 'success', title: t('menu.categoryDeleted') }),
      onError: (err) =>
        notify({
          type: 'error',
          title: t('menu.cannotDeleteCategory'),
          message: getErrorMessage(err),
        }),
    });
  };

  const rowActions = (onEdit: () => void, onDelete: () => void, extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-1">
      {extra}
      <Button size="sm" variant="ghost" onClick={onEdit} title={t('common.edit')}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} title={t('common.delete')}>
        <Trash2 className="h-3.5 w-3.5 text-red-500" />
      </Button>
    </div>
  );

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

      {canEdit && (
        <CollapsibleSection
          title={t('menu.categories')}
          description={t('menu.categoriesDesc')}
          defaultOpen
          badge={<Badge color="blue" size="sm">{categories.length}</Badge>}
        >
          {loadingCategories ? (
            <Spinner />
          ) : categories.length === 0 ? (
            <EmptyState title={t('menu.noCategories')} description={t('menu.noCategoriesDesc')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-compact min-w-[560px]">
                <thead>
                  <tr>
                    <th>{t('common.image')}</th>
                    <th>{t('common.name')}</th>
                    <th>{t('menu.description')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td>
                        <MenuImage src={(cat as CategoryRow).image_url} alt={cat.name} size="xs" />
                      </td>
                      <td className="py-3 pr-4 font-medium">{cat.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{cat.description ?? '—'}</td>
                      <td>
                        <Badge color={cat.is_active ? 'green' : 'gray'} size="sm">
                          {cat.is_active ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </td>
                      <td>
                        {rowActions(
                          () => openEditCategory(cat as CategoryRow),
                          () => handleDeleteCategory(cat as CategoryRow),
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleCategory.mutate({ id: cat.id, is_active: !cat.is_active })}
                          >
                            {cat.is_active ? t('menu.deactivate') : t('menu.activate')}
                          </Button>,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t('menu.products')}
        description={canEdit ? t('menu.productsDescEdit') : t('menu.productsDescBrowse')}
        defaultOpen
        badge={<Badge color="blue" size="sm">{products.length}</Badge>}
      >
        {isError && <p className="mb-3 text-sm text-red-600">{getErrorMessage(error)}</p>}
        {isFetching ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState title={t('menu.noProducts')} description={t('menu.noProductsDesc')} />
        ) : (
          <div className="space-y-6">
            {[...productsByCategory.entries()].map(([catName, items]) => (
              <div key={catName}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{catName}</p>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="table-compact min-w-[640px]">
                    <thead>
                      <tr>
                        <th>{t('common.image')}</th>
                        <th>{t('common.name')}</th>
                        <th>{t('menu.sku')}</th>
                        <th>{t('menu.price')}</th>
                        <th>{t('menu.stock')}</th>
                        <th>{t('common.status')}</th>
                        {canEdit && <th>{t('common.actions')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <MenuImage src={p.image_url} alt={p.name} size="xs" />
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {p.name}
                            {warehouseProductIds?.has(p.id) && (
                              <Badge color="blue" size="sm" className="ml-2">
                                {t('menu.warehouseBadge')}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{p.sku ?? '—'}</td>
                          <td>{formatCurrency(Number(p.price))}</td>
                          <td>{p.stock_quantity}</td>
                          <td>
                            <Badge color={p.is_active ? 'green' : 'gray'} size="sm">
                              {p.is_active ? t('common.active') : t('common.inactive')}
                            </Badge>
                          </td>
                          {canEdit && (
                            <td>
                              {rowActions(
                                () => openEditProduct(p as ProductRow),
                                () => handleDeleteProduct(p as ProductRow),
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateProduct.mutate({ id: p.id, is_active: !p.is_active })
                                  }
                                >
                                  {p.is_active ? t('common.off') : t('common.on')}
                                </Button>,
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        {isError && (
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        )}
      </CollapsibleSection>

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
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('menu.price')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  required
                />
                <Input
                  label={t('menu.stockQty')}
                  type="number"
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
              <Input label={t('menu.sku')} value={pSku} onChange={(e) => setPSku(e.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pActive}
                  onChange={(e) => setPActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {t('menu.activeOnMenu')}
              </label>
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
