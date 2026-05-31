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

      const cat = (p.categories as { name: string } | null)?.name ?? 'Uncategorized';

      if (!map.has(cat)) map.set(cat, []);

      map.get(cat)!.push(p);

    }

    return map;

  }, [products]);



  if (profile?.role !== 'SUPER_ADMIN' && !restaurantId) {

    return (

      <div className="space-y-6">

        <h2 className="text-2xl font-bold">Menu</h2>

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

      notify({ type: 'warning', title: 'Add a category first' });

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

      notify({ type: 'error', title: 'Select a category' });

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

        notify({ type: 'success', title: 'Product updated' });

      } else {

        await createProduct.mutateAsync({ ...payload, tax_rate: 10, is_active: pActive });

        notify({ type: 'success', title: 'Product added' });

      }

      setProductOpen(false);

      resetProductForm();

    } catch (err) {

      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });

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

      notify({ type: 'success', title: editCategoryId ? 'Category updated' : 'Category added' });

      setCategoryOpen(false);

      resetCategoryForm();

    } catch (err) {

      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });

    }

  };



  const handleDeleteProduct = (p: ProductRow) => {

    if (!window.confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;

    deleteProduct.mutate(p.id, {

      onSuccess: () => notify({ type: 'success', title: 'Product deleted' }),

      onError: (err) =>

        notify({

          type: 'error',

          title: 'Cannot delete product',

          message: getErrorMessage(err),

        }),

    });

  };



  const handleDeleteCategory = (cat: CategoryRow) => {

    if (!window.confirm(`Delete category "${cat.name}"? Products in this category must be moved or deleted first.`)) {

      return;

    }

    deleteCategory.mutate(cat.id, {

      onSuccess: () => notify({ type: 'success', title: 'Category deleted' }),

      onError: (err) =>

        notify({

          type: 'error',

          title: 'Cannot delete category',

          message: getErrorMessage(err),

        }),

    });

  };



  const rowActions = (onEdit: () => void, onDelete: () => void, extra?: React.ReactNode) => (

    <div className="flex flex-wrap items-center gap-1">

      {extra}

      <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">

        <Pencil className="h-3.5 w-3.5" />

      </Button>

      <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">

        <Trash2 className="h-3.5 w-3.5 text-red-500" />

      </Button>

    </div>

  );



  return (

    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <h2 className="text-2xl font-bold">Menu</h2>

          <p className="text-sm text-slate-500">Categories and products in one place</p>

        </div>

        {canEdit && (

          <div className="flex gap-2">

            <Button variant="secondary" onClick={openNewCategory}>

              <Plus className="h-4 w-4" /> Category

            </Button>

            <Button onClick={openNewProduct}>

              <Plus className="h-4 w-4" /> Product

            </Button>

          </div>

        )}

      </div>



      <div className="relative max-w-md">

        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <Input

          className="pl-10"

          placeholder="Search products…"

          value={search}

          onChange={(e) => setSearch(e.target.value)}

        />

      </div>



      {canEdit && (

        <CollapsibleSection

          title="Categories"

          description="Menu sections (Drinks, Mains, …)"

          defaultOpen

          badge={<Badge color="blue" size="sm">{categories.length}</Badge>}

        >

          {loadingCategories ? (

            <Spinner />

          ) : categories.length === 0 ? (

            <EmptyState title="No categories" description="Add your first category above." />

          ) : (

            <div className="overflow-x-auto">

              <table className="table-compact min-w-[560px]">

                <thead>

                  <tr>

                    <th>Image</th>

                    <th>Name</th>

                    <th>Description</th>

                    <th>Status</th>

                    <th>Actions</th>

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

                          {cat.is_active ? 'Active' : 'Off'}

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

                            {cat.is_active ? 'Deactivate' : 'Activate'}

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

        title="Products"

        description={canEdit ? 'Sellable menu items' : 'Browse the menu'}

        defaultOpen

        badge={<Badge color="blue" size="sm">{products.length}</Badge>}

      >

        {isError && <p className="mb-3 text-sm text-red-600">{getErrorMessage(error)}</p>}

        {isFetching ? (

          <Spinner />

        ) : products.length === 0 ? (

          <EmptyState title="No products" description="Add categories and products to build your menu." />

        ) : (

          <div className="space-y-6">

            {[...productsByCategory.entries()].map(([catName, items]) => (

              <div key={catName}>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{catName}</p>

                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">

                  <table className="table-compact min-w-[640px]">

                    <thead>

                      <tr>

                        <th>Image</th>

                        <th>Name</th>

                        <th>SKU</th>

                        <th>Price</th>

                        <th>Stock</th>

                        <th>Status</th>

                        {canEdit && <th>Actions</th>}

                      </tr>

                    </thead>

                    <tbody>

                      {items.map((p) => (

                        <tr key={p.id}>

                          <td>

                            <MenuImage src={p.image_url} alt={p.name} size="xs" />

                          </td>

                          <td className="px-3 py-2 font-medium">{p.name}</td>

                          <td className="px-3 py-2 text-slate-500">{p.sku ?? '—'}</td>

                          <td>{formatCurrency(Number(p.price))}</td>

                          <td>{p.stock_quantity}</td>

                          <td>

                            <Badge color={p.is_active ? 'green' : 'gray'} size="sm">

                              {p.is_active ? 'Active' : 'Off'}

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

                                  {p.is_active ? 'Off' : 'On'}

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

            Retry

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

            title={editProductId ? 'Edit product' : 'New product'}

          >

            <form onSubmit={submitProduct} className="space-y-4">

              <ImageUrlField label="Product image" value={pImage} onChange={setPImage} previewAlt={pName || 'Product'} />

              <Input label="Name" value={pName} onChange={(e) => setPName(e.target.value)} required />

              <Select

                label="Category"

                value={pCategoryId}

                onChange={(e) => setPCategoryId(e.target.value)}

                options={categoryOptions}

                required

              />

              <div className="grid gap-4 sm:grid-cols-2">

                <Input

                  label="Price"

                  type="number"

                  step="0.01"

                  min="0"

                  value={pPrice}

                  onChange={(e) => setPPrice(e.target.value)}

                  required

                />

                <Input

                  label="Stock qty"

                  type="number"

                  min="0"

                  value={pStock}

                  onChange={(e) => setPStock(e.target.value)}

                />

              </div>

              <Input

                label="Cost price"

                type="number"

                step="0.01"

                min="0"

                value={pCost}

                onChange={(e) => setPCost(e.target.value)}

              />

              <Input label="SKU" value={pSku} onChange={(e) => setPSku(e.target.value)} />

              <label className="flex items-center gap-2 text-sm">

                <input

                  type="checkbox"

                  checked={pActive}

                  onChange={(e) => setPActive(e.target.checked)}

                  className="rounded border-slate-300"

                />

                Active on menu

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

                  Cancel

                </Button>

                <Button

                  type="submit"

                  loading={createProduct.isPending || updateProduct.isPending}

                >

                  Save

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

            title={editCategoryId ? 'Edit category' : 'New category'}

          >

            <form onSubmit={submitCategory} className="space-y-4">

              <ImageUrlField

                label="Category image"

                value={cImage}

                onChange={setCImage}

                previewAlt={cName || 'Category'}

              />

              <Input label="Name" value={cName} onChange={(e) => setCName(e.target.value)} required />

              <Input label="Description" value={cDesc} onChange={(e) => setCDesc(e.target.value)} />

              <div className="flex justify-end gap-2">

                <Button

                  type="button"

                  variant="ghost"

                  onClick={() => {

                    setCategoryOpen(false);

                    resetCategoryForm();

                  }}

                >

                  Cancel

                </Button>

                <Button type="submit" loading={upsertCategory.isPending}>

                  Save

                </Button>

              </div>

            </form>

          </Modal>

        </>

      )}

    </div>

  );

}

