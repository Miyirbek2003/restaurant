import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { MenuImage } from '@/components/ui/MenuImage';
import { ImageUrlField } from '@/components/ui/ImageUrlField';
import {
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useRecordInventoryPurchase,
  useInventoryPurchases,
  useToggleInventoryMenuVisibility,
  inventoryProfit,
  isSaleInventoryItem,
  type InventoryItemRow,
  type InventoryItemType,
  type InventoryPurchaseResult,
} from '@/hooks/useInventory';
import { useCategories } from '@/hooks/useProducts';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { defaultDateRangeMonth, matchesDateRange, matchesSearch } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { t, inventoryUnit, expenseCategory } from '@/i18n';

const UNITS = ['KG', 'G', 'LITER', 'ML', 'PIECE'].map((value) => ({
  value,
  label: inventoryUnit(value),
}));

const emptyForm = {
  name: '',
  unit: 'PIECE',
  itemType: 'KITCHEN' as InventoryItemType,
  minQty: '',
  purchasePrice: '',
  sellingPrice: '',
  imageUrl: '',
  categoryId: '',
};

export function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const { data: categories = [] } = useCategories();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const recordPurchase = useRecordInventoryPurchase();
  const [itemFilters, setItemFilters] = useState<ListFiltersValue>({
    search: '',
    dateFrom: '',
    dateTo: '',
    category: '',
  });
  const [historyFilters, setHistoryFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeMonth();
    return { search: '', dateFrom: range.from, dateTo: range.to };
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useInventoryPurchases({
    dateFrom: historyFilters.dateFrom || undefined,
    dateTo: historyFilters.dateTo || undefined,
    limit: 200,
  });
  const toggleMenu = useToggleInventoryMenuVisibility();
  const notify = useNotificationStore((s) => s.add);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [stockOpen, setStockOpen] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockUnitCost, setStockUnitCost] = useState('');
  const [stockDate, setStockDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stockNotes, setStockNotes] = useState('');
  const [lastPurchase, setLastPurchase] = useState<InventoryPurchaseResult | null>(null);

  const [publishItem, setPublishItem] = useState<InventoryItemRow | null>(null);
  const [publishCategoryId, setPublishCategoryId] = useState('');

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const itemTypeOptions = useMemo(
    () => [
      { value: 'KITCHEN' as const, label: t('warehouse.typeKitchen') },
      { value: 'SALE' as const, label: t('warehouse.typeSale') },
    ],
    [],
  );

  const warehouseCategoryOptions = useMemo(
    () => [{ value: '', label: t('filters.allCategories') }, ...categoryOptions],
    [categoryOptions],
  );

  const filterItems = (list: InventoryItemRow[]) =>
    list.filter((i) => {
      if (itemFilters.category && i.category_id !== itemFilters.category) return false;
      return matchesSearch(itemFilters.search, i.name);
    });

  const kitchenItems = useMemo(
    () => filterItems(items.filter((i) => !isSaleInventoryItem(i))),
    [items, itemFilters.search, itemFilters.category],
  );
  const saleItems = useMemo(
    () => filterItems(items.filter((i) => isSaleInventoryItem(i))),
    [items, itemFilters.search, itemFilters.category],
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((row) => {
        const item = row.inventory_items;
        const exp = row.expenses;
        const dateVal = exp?.date ?? row.created_at;
        return (
          matchesSearch(historyFilters.search, item?.name, exp?.title, row.notes) &&
          matchesDateRange(dateVal, historyFilters.dateFrom, historyFilters.dateTo)
        );
      }),
    [purchases, historyFilters],
  );

  const itemGridClass = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

  const isSaleForm = form.itemType === 'SALE';

  const stockItem = useMemo(
    () => items.find((i) => i.id === stockOpen) ?? null,
    [items, stockOpen],
  );

  const stockQtyNum = parseFloat(stockQty) || 0;
  const stockUnitCostNum = parseFloat(stockUnitCost) || 0;
  const stockTotal = stockQtyNum * stockUnitCostNum;
  const stockAfter = stockItem ? Number(stockItem.quantity) + stockQtyNum : 0;

  const openStockIn = (item: InventoryItemRow) => {
    setStockOpen(item.id);
    setStockQty('');
    setStockUnitCost(String(item.cost_per_unit ?? 0));
    setStockDate(new Date().toISOString().slice(0, 10));
    setStockNotes('');
    setLastPurchase(null);
  };

  const openAdd = () => {
    setEditId(null);
    setForm({
      ...emptyForm,
      categoryId: categoryOptions[0]?.value ?? '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItemRow) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      itemType: item.item_type ?? 'KITCHEN',
      minQty: String(item.minimum_quantity),
      purchasePrice: String(item.cost_per_unit),
      sellingPrice: String(item.selling_price ?? 0),
      imageUrl: item.image_url ?? '',
      categoryId: item.category_id ?? categoryOptions[0]?.value ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      unit: form.unit,
      item_type: form.itemType,
      cost_per_unit: parseFloat(form.purchasePrice) || 0,
      selling_price: isSaleForm ? parseFloat(form.sellingPrice) || 0 : 0,
      image_url: isSaleForm ? form.imageUrl || undefined : undefined,
      category_id: isSaleForm ? form.categoryId || undefined : null,
      minimum_quantity: editId ? parseFloat(form.minQty) || 0 : 0,
    };
    try {
      if (editId) {
        await updateItem.mutateAsync({ id: editId, ...payload });
        notify({ type: 'success', title: t('warehouse.itemUpdated') });
      } else {
        await createItem.mutateAsync(payload);
        notify({ type: 'success', title: t('warehouse.itemAdded') });
      }
      setModalOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const handleDelete = (item: InventoryItemRow) => {
    if (!window.confirm(t('warehouse.deleteConfirm', { name: item.name }))) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => notify({ type: 'success', title: t('warehouse.deleted') }),
      onError: (err) => notify({ type: 'error', title: t('tables.deleteFailed'), message: getErrorMessage(err) }),
    });
  };

  const handleStockIn = async () => {
    if (!stockOpen || !stockQtyNum) return;
    try {
      const result = await recordPurchase.mutateAsync({
        inventory_item_id: stockOpen,
        quantity: stockQtyNum,
        unit_cost: stockUnitCostNum,
        date: stockDate,
        notes: stockNotes.trim() || undefined,
      });
      setLastPurchase(result);
      notify({
        type: 'success',
        title: t('warehouse.purchaseSuccess'),
        message: t('warehouse.expenseWillCreate') + `: ${formatCurrency(result.total_cost)}`,
      });
      setStockQty('');
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const closeStockModal = () => {
    setStockOpen(null);
    setLastPurchase(null);
  };

  const isMenuVisible = (item: InventoryItemRow) =>
    Boolean(item.product_id && item.products?.is_active);

  const handleToggleMenu = async (item: InventoryItemRow) => {
    const visible = isMenuVisible(item);
    if (!visible && !item.category_id && categoryOptions.length === 0) {
      notify({ type: 'warning', title: t('warehouse.addCategoryFirst'), message: t('warehouse.noCategoryHint') });
      return;
    }
    if (!visible && !item.category_id) {
      setPublishItem(item);
      setPublishCategoryId(categoryOptions[0]?.value ?? '');
      return;
    }
    try {
      await toggleMenu.mutateAsync({
        item,
        visible: !visible,
        categoryId: item.category_id ?? undefined,
      });
      notify({
        type: 'success',
        title: visible ? t('warehouse.hiddenFromMenu') : t('warehouse.visibleOnMenu'),
      });
    } catch (err) {
      if (getErrorMessage(err) === 'SELECT_CATEGORY' || (err as Error).message === 'SELECT_CATEGORY') {
        setPublishItem(item);
        setPublishCategoryId(categoryOptions[0]?.value ?? '');
        return;
      }
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  const renderItemCard = (item: InventoryItemRow) => {
    const low = Number(item.quantity) < Number(item.minimum_quantity);
    const forSale = isSaleInventoryItem(item);
    const { marginPerUnit, totalCost, potentialRevenue, profit } = inventoryProfit(item);
    const onMenu = isMenuVisible(item);
    const menuCategoryName = item.category_id
      ? categories.find((c) => c.id === item.category_id)?.name
      : null;

    return (
      <Card key={item.id} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <MenuImage src={item.image_url} alt={item.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{item.name}</h3>
              <div className="flex flex-wrap gap-1">
                <Badge color={forSale ? 'blue' : 'yellow'}>
                  {forSale ? t('warehouse.saleBadge') : t('warehouse.kitchenBadge')}
                </Badge>
                {forSale && menuCategoryName && (
                  <Badge color="gray" size="sm">
                    {menuCategoryName}
                  </Badge>
                )}
                {low && <Badge color="red">{t('warehouse.lowStock')}</Badge>}
                {forSale &&
                  (onMenu ? (
                    <Badge color="green">{t('warehouse.onMenu')}</Badge>
                  ) : item.product_id ? (
                    <Badge color="gray">{t('warehouse.hidden')}</Badge>
                  ) : null)}
              </div>
            </div>
            <p className="text-sm text-slate-500">
              {item.quantity} {inventoryUnit(item.unit)}
              {item.minimum_quantity > 0 ? ` · ${t('warehouse.minShort')} ${item.minimum_quantity}` : ''}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">{t('warehouse.purchasePrice')}</dt>
          <dd className="font-medium">{formatCurrency(Number(item.cost_per_unit))}</dd>
          {forSale && (
            <>
              <dt className="text-slate-500">{t('warehouse.sellingPrice')}</dt>
              <dd className="font-medium">{formatCurrency(Number(item.selling_price))}</dd>
              <dt className="text-slate-500">{t('warehouse.marginUnit')}</dt>
              <dd className={marginPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {formatCurrency(marginPerUnit)}
              </dd>
            </>
          )}
          <dt className="text-slate-500">{t('warehouse.stockValue')}</dt>
          <dd>{formatCurrency(totalCost)}</dd>
          {forSale && (
            <>
              <dt className="text-slate-500">{t('warehouse.potentialRevenue')}</dt>
              <dd>{formatCurrency(potentialRevenue)}</dd>
              <dt className="text-slate-500 font-medium">{t('warehouse.estProfit')}</dt>
              <dd className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(profit)}
              </dd>
            </>
          )}
        </dl>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Button size="sm" variant="secondary" onClick={() => openStockIn(item)}>
            {t('warehouse.addStock')}
          </Button>
          {forSale && (
            <Button
              size="sm"
              variant={onMenu ? 'secondary' : 'primary'}
              loading={toggleMenu.isPending}
              onClick={() => void handleToggleMenu(item)}
            >
              {onMenu ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> {t('warehouse.hideMenu')}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> {t('warehouse.showMenu')}
                </>
              )}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(item)}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      </Card>
    );
  };

  const confirmPublish = async () => {
    if (!publishItem || !publishCategoryId) {
      notify({ type: 'warning', title: t('menu.selectCategory') });
      return;
    }
    try {
      await toggleMenu.mutateAsync({
        item: { ...publishItem, category_id: publishCategoryId },
        visible: true,
        categoryId: publishCategoryId,
      });
      notify({ type: 'success', title: t('warehouse.visibleOnMenu') });
      setPublishItem(null);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">{t('warehouse.title')}</h2>
          <p className="text-sm text-slate-500">{t('warehouse.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('warehouse.addItem')}
        </Button>
      </div>

      <ListFilters
        value={itemFilters}
        onChange={setItemFilters}
        showDates={false}
        searchPlaceholder={t('warehouse.searchItems')}
        categoryOptions={warehouseCategoryOptions}
        categoryLabel={t('warehouse.menuCategory')}
      />

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title={t('warehouse.noItems')} description={t('warehouse.noItemsDesc')} />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{t('warehouse.sectionKitchen')}</h3>
              <p className="text-sm text-slate-500">{t('warehouse.sectionKitchenDesc')}</p>
            </div>
            {kitchenItems.length === 0 ? (
              <p className="text-sm text-slate-500">{t('warehouse.noKitchenItems')}</p>
            ) : (
              <div className={itemGridClass}>{kitchenItems.map(renderItemCard)}</div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{t('warehouse.sectionSale')}</h3>
              <p className="text-sm text-slate-500">{t('warehouse.sectionSaleDesc')}</p>
            </div>
            {saleItems.length === 0 ? (
              <p className="text-sm text-slate-500">{t('warehouse.noSaleItems')}</p>
            ) : (
              <div className={itemGridClass}>{saleItems.map(renderItemCard)}</div>
            )}
          </section>
        </div>
      )}

      <CollapsibleSection
        title={t('warehouse.purchaseHistory')}
        subtitle={t('warehouse.purchaseHistoryHint')}
        defaultOpen={false}
        badge={
          <Badge color="gray" size="sm">
            {filteredPurchases.length}
          </Badge>
        }
      >
        <ListFilters
          value={historyFilters}
          onChange={setHistoryFilters}
          searchPlaceholder={t('warehouse.searchHistory')}
          className="mb-4 border-0 bg-slate-50 p-0 dark:bg-slate-900/50"
        />
        {purchasesLoading ? (
          <Spinner />
        ) : filteredPurchases.length === 0 ? (
          <p className="text-sm text-slate-500">{t('warehouse.purchaseHistoryEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colDate')}</th>
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colItem')}</th>
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colQty')}</th>
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colUnitCost')}</th>
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colAmount')}</th>
                <th className="pb-2 pr-3 font-medium">{t('warehouse.colExpense')}</th>
                <th className="pb-2 font-medium">{t('expenses.category')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((row) => {
                const item = row.inventory_items;
                const exp = row.expenses;
                const unitCost =
                  row.cost != null && row.quantity
                    ? Number(row.cost) / Number(row.quantity)
                    : 0;
                return (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {exp?.date
                        ? format(new Date(exp.date), 'dd.MM.yyyy')
                        : format(new Date(row.created_at), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="py-2 pr-3">{item?.name ?? '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.quantity} {item ? inventoryUnit(item.unit) : ''}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{formatCurrency(unitCost)}</td>
                    <td className="py-2 pr-3 font-medium tabular-nums text-red-600">
                      {formatCurrency(Number(exp?.amount ?? row.cost ?? 0))}
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={exp?.title ?? ''}>
                      {exp?.title ?? row.notes ?? '—'}
                    </td>
                    <td className="py-2">
                      {exp?.category ? expenseCategory(exp.category) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </CollapsibleSection>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? t('warehouse.editItem') : t('warehouse.newItem')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t('common.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label={t('warehouse.itemType')}
            value={form.itemType}
            onChange={(e) => setForm({ ...form, itemType: e.target.value as InventoryItemType })}
            options={itemTypeOptions}
          />
          <Select
            label={t('warehouse.unit')}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            options={UNITS}
          />
          <Input
            label={t('warehouse.purchasePrice')}
            type="number"
            step="0.01"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
          />
          {editId && (
            <Input
              label={t('warehouse.minQuantity')}
              type="number"
              step="0.001"
              value={form.minQty}
              onChange={(e) => setForm({ ...form, minQty: e.target.value })}
            />
          )}
          {!editId && (
            <p className="text-sm text-slate-500">{t('warehouse.qtyViaStockIn')}</p>
          )}
          {isSaleForm && (
            <>
              <Input
                label={t('warehouse.sellingPrice')}
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              />
              {categoryOptions.length > 0 ? (
                <Select
                  label={t('warehouse.menuCategory')}
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  options={categoryOptions}
                />
              ) : (
                <p className="text-sm text-amber-600">{t('warehouse.noCategoryHint')}</p>
              )}
              <ImageUrlField
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                previewAlt={form.name || t('common.item')}
              />
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createItem.isPending || updateItem.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!stockOpen} onClose={closeStockModal} title={t('warehouse.addStockTitle')}>
        <div className="space-y-4">
          {stockItem && (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{stockItem.name}</p>
          )}

          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900/50 sm:grid-cols-2">
            <div>
              <span className="text-slate-500">{t('warehouse.currentStock')}</span>
              <p className="font-medium tabular-nums">
                {stockItem ? `${stockItem.quantity} ${inventoryUnit(stockItem.unit)}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">{t('warehouse.stockAfter')}</span>
              <p className="font-medium tabular-nums">
                {stockItem ? `${stockAfter} ${inventoryUnit(stockItem.unit)}` : '—'}
              </p>
            </div>
          </div>

          <Input
            label={t('warehouse.qtyToAdd')}
            type="number"
            step="0.001"
            min="0"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            required
          />
          <Input
            label={t('warehouse.unitCost')}
            type="number"
            step="0.01"
            min="0"
            value={stockUnitCost}
            onChange={(e) => setStockUnitCost(e.target.value)}
          />
          <Input
            label={t('warehouse.purchaseDate')}
            type="date"
            value={stockDate}
            onChange={(e) => setStockDate(e.target.value)}
          />
          <Input
            label={t('warehouse.purchaseNotes')}
            value={stockNotes}
            onChange={(e) => setStockNotes(e.target.value)}
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-slate-600 dark:text-slate-400">{t('warehouse.expenseWillCreate')}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-red-600">
              {t('warehouse.purchaseTotal')}: {formatCurrency(stockTotal)}
            </p>
          </div>

          {lastPurchase && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">{t('warehouse.purchaseSuccess')}</p>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">{t('warehouse.linkedExpense')}</dt>
                  <dd>{lastPurchase.expense_title}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('warehouse.colDate')}</dt>
                  <dd>{format(new Date(lastPurchase.expense_date), 'dd.MM.yyyy')}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('warehouse.colAmount')}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(lastPurchase.total_cost)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('expenses.category')}</dt>
                  <dd>{expenseCategory(lastPurchase.expense_category)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('warehouse.colQty')}</dt>
                  <dd>
                    +{lastPurchase.quantity_added} {inventoryUnit(lastPurchase.unit)} ×{' '}
                    {formatCurrency(lastPurchase.unit_cost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('warehouse.stockAfter')}</dt>
                  <dd>
                    {lastPurchase.quantity_after} {inventoryUnit(lastPurchase.unit)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={closeStockModal}>
              {lastPurchase ? t('common.close') : t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              loading={recordPurchase.isPending}
              disabled={!stockQtyNum}
              onClick={() => void handleStockIn()}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={publishItem !== null} onClose={() => setPublishItem(null)} title={t('warehouse.publishTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t('warehouse.publishDesc', { name: publishItem?.name ?? '' })}</p>
          <Select
            label={t('warehouse.category')}
            value={publishCategoryId}
            onChange={(e) => setPublishCategoryId(e.target.value)}
            options={categoryOptions}
          />
          <Button className="w-full" loading={toggleMenu.isPending} onClick={() => void confirmPublish()}>
            {t('warehouse.showMenu')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
