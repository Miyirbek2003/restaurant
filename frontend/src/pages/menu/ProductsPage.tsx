import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { useProducts, useCategories, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantId } from '@/contexts/AuthContext';
import { isManager } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

export function ProductsPage() {
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const canEdit = profile?.role && isManager(profile.role);
  const [search, setSearch] = useState('');
  const {
    data: products = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useProducts(search || undefined, !canEdit);
  const { data: categories = [], isFetching: loadingCategories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [costPrice, setCostPrice] = useState('');

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setPrice('');
    setSku('');
    setCostPrice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      notify({ type: 'error', title: 'Select a category first' });
      return;
    }
    if (!restaurantId) {
      notify({ type: 'error', title: 'Restaurant not assigned', message: 'See setup instructions below.' });
      return;
    }
    try {
      await createProduct.mutateAsync({
        name,
        category_id: categoryId,
        price: parseFloat(price),
        sku: sku || undefined,
        cost_price: costPrice ? parseFloat(costPrice) : 0,
        tax_rate: 10,
        is_active: true,
      });
      notify({ type: 'success', title: 'Product added' });
      setOpen(false);
      resetForm();
    } catch (err) {
      notify({ type: 'error', title: 'Could not save product', message: getErrorMessage(err) });
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await updateProduct.mutateAsync({ id, is_active: !is_active });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  if (profile?.role !== 'SUPER_ADMIN' && !restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Products</h2>
        <RestaurantRequired />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">{canEdit ? 'Products' : 'Menu'}</h2>
        {canEdit && (
          <Button
            onClick={() => {
              if (categoryOptions.length === 0) {
                notify({
                  type: 'warning',
                  title: 'Create a category first',
                  message: 'Go to Menu categories and add at least one category.',
                });
                return;
              }
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add product
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isError && (
        <Card className="border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(error)}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}

      {isFetching ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products"
          description={
            canEdit
              ? categoryOptions.length === 0
                ? 'Add a category first, then add products.'
                : 'Add your first menu item.'
              : 'No menu items yet.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="relative">
              <div className="absolute right-3 top-3">
                <Badge color={p.is_active ? 'green' : 'gray'} size="sm">
                  {p.is_active ? 'Active' : 'Off'}
                </Badge>
              </div>
              <div className="pr-14">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-slate-500">{(p.categories as { name: string } | null)?.name}</p>
                {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
              </div>
              <p className="mt-4 text-xl font-bold text-primary-600">{formatCurrency(Number(p.price))}</p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => toggleActive(p.id, p.is_active)}
                >
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {canEdit && (
        <Modal open={open} onClose={() => !createProduct.isPending && setOpen(false)} title="New product">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            {loadingCategories ? (
              <p className="text-sm text-slate-500">Loading categories…</p>
            ) : categoryOptions.length === 0 ? (
              <p className="text-sm text-amber-600">No categories — add one under Menu categories first.</p>
            ) : (
              <Select
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categoryOptions}
                required
              />
            )}
            <Input
              label="Price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <Input
              label="Cost price"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
            <Input label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={createProduct.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createProduct.isPending}
                disabled={categoryOptions.length === 0}
              >
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
