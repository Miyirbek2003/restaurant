import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResourceInsert, useResourceUpdate, useResourceDelete } from '@/hooks/useResource';
import { useExpensesList } from '@/hooks/useExpenses';
import { useEmployees } from '@/hooks/useEmployees';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { defaultDateRangeDays, matchesDateRange, matchesSearch } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import { t, expenseCategory } from '@/i18n';

const CATEGORY_VALUES = ['RENT', 'SALARIES', 'UTILITIES', 'INTERNET', 'MARKETING', 'INGREDIENTS', 'CLEANING', 'OTHER'] as const;

const CATEGORIES = CATEGORY_VALUES.map((value) => ({
  value,
  label: expenseCategory(value),
}));

const CATEGORY_FILTER_OPTIONS = [{ value: '', label: t('filters.allCategories') }, ...CATEGORIES];

type ExpenseForm = {
  title: string;
  category: string;
  amount: string;
  date: string;
  notes: string;
  staff_id: string;
};

const emptyForm = (): ExpenseForm => ({
  title: '',
  category: 'OTHER',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  staff_id: '',
});

export function ExpensesPage() {
  const { data = [], isLoading } = useExpensesList();
  const { data: employees = [] } = useEmployees();
  const insert = useResourceInsert('expenses');
  const update = useResourceUpdate('expenses');
  const remove = useResourceDelete('expenses');
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeDays(90);
    return { search: '', dateFrom: range.from, dateTo: range.to, category: '' };
  });

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (filters.category && row.category !== filters.category) return false;
        return (
          matchesDateRange(row.date, filters.dateFrom, filters.dateTo) &&
          matchesSearch(
            filters.search,
            row.title,
            row.notes,
            expenseCategory(row.category),
            row.staff?.name,
          )
        );
      }),
    [data, filters],
  );

  const totalExpenses = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.amount), 0),
    [filtered],
  );

  const staffOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const isSalary = form.category === 'SALARIES';

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: (typeof data)[0]) => {
    setEditId(row.id);
    setForm({
      title: row.title,
      category: row.category,
      amount: String(row.amount),
      date: row.date,
      notes: row.notes ?? '',
      staff_id: row.staff_id ?? '',
    });
    setOpen(true);
  };

  const onStaffChange = (staffId: string) => {
    const emp = employees.find((e) => e.id === staffId);
    setForm((f) => ({
      ...f,
      staff_id: staffId,
      title:
        emp && f.category === 'SALARIES'
          ? t('expenses.salaryTitle', { name: emp.name })
          : f.title,
    }));
  };

  const onCategoryChange = (category: string) => {
    setForm((f) => ({
      ...f,
      category,
      staff_id: category === 'SALARIES' ? f.staff_id : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSalary && !form.staff_id) {
      notify({ type: 'warning', title: t('expenses.selectEmployee') });
      return;
    }
    const body: Record<string, unknown> = {
      title: form.title,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      notes: form.notes || null,
      staff_id: isSalary ? form.staff_id : null,
    };
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, ...body });
        notify({ type: 'success', title: t('expenses.updated') });
      } else {
        await insert.mutateAsync(body);
        notify({ type: 'success', title: t('expenses.added') });
      }
      setOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('expenses.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('expenses.add')}
        </Button>
      </div>

      <ListFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder={t('expenses.searchPlaceholder')}
        categoryOptions={CATEGORY_FILTER_OPTIONS}
        categoryLabel={t('expenses.category')}
      />

      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('expenses.totalForPeriod')}</p>
        <p className="text-2xl font-bold tabular-nums text-red-600">{formatCurrency(totalExpenses)}</p>
        <p className="mt-1 text-sm text-slate-500">{t('expenses.countInPeriod', { n: filtered.length })}</p>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={t('expenses.empty')} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('filters.noResults')} />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-slate-500">
                  {expenseCategory(row.category)}
                  {row.staff?.name ? ` · ${row.staff.name}` : ''} · {row.date}
                </p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(Number(row.amount))}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t('expenses.deleteConfirm', { title: row.title }))) {
                      remove.mutate(row.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('expenses.edit') : t('expenses.new')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label={t('expenses.category')}
            value={form.category}
            onChange={(e) => onCategoryChange(e.target.value)}
            options={CATEGORIES}
          />
          {isSalary && (
            <Select
              label={t('expenses.employee')}
              value={form.staff_id}
              onChange={(e) => onStaffChange(e.target.value)}
              options={[{ value: '', label: t('expenses.chooseEmployee') }, ...staffOptions]}
              required
            />
          )}
          <Input
            label={t('expenses.titleField')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Input
            label={t('expenses.amount')}
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Input
            label={t('expenses.date')}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <Input label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={insert.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
