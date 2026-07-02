import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResourceInsert } from '@/hooks/useResource';
import { useExpensesList, type ExpenseRow } from '@/hooks/useExpenses';
import { useEmployees } from '@/hooks/useEmployees';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { defaultDateRangeMonth, lastDaysRange, matchesDateRange, matchesSearch, todayRange, yesterdayRange } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import { t, expenseCategory } from '@/i18n';

const CATEGORY_VALUES = ['RENT', 'SALARIES', 'UTILITIES', 'INTERNET', 'MARKETING', 'INGREDIENTS', 'CLEANING', 'OTHER'] as const;

const CATEGORIES = CATEGORY_VALUES.map((value) => ({
  value,
  label: expenseCategory(value),
}));

const CATEGORY_FILTER_OPTIONS = [{ value: '', label: t('filters.allCategories') }, ...CATEGORIES];

function expenseTitle(title: string | null | undefined, category: string): string {
  const trimmed = title?.trim() ?? '';
  return trimmed || expenseCategory(category);
}

function expenseListHeading(row: ExpenseRow): string {
  const base = expenseTitle(row.title, row.category);
  if (row.category !== 'SALARIES') return base;
  const receiver = row.staff?.name ?? t('salaries.unassigned');
  return `${base} · ${receiver}`;
}

type ExpenseForm = {
  title: string;
  category: string;
  amount: string;
  date: string;
  notes: string;
  staff_id: string;
  fromKassa: boolean;
};

const emptyForm = (): ExpenseForm => ({
  title: '',
  category: 'OTHER',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  staff_id: '',
  fromKassa: false,
});

export function ExpensesPage() {
  const pageSize = 10;
  const { profile } = useAuth();
  const { data = [], isLoading } = useExpensesList();
  const { data: employees = [] } = useEmployees();
  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();
  const insert = useResourceInsert('expenses');
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeMonth();
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
  const paged = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const staffOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const isSalary = form.category === 'SALARIES';
  const isKassaOwner = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );
  const cashierCreateBlocked = Boolean(profile?.role === 'CASHIER' && openKassa && !isKassaOwner);
  const canTakeFromKassa = Boolean(openKassa && isKassaOwner);
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filters.search, filters.dateFrom, filters.dateTo, filters.category]);

  const applyRange = (range: { from: string; to: string }) =>
    setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to }));

  const resetFilters = () => {
    const range = defaultDateRangeMonth();
    setFilters({ search: '', dateFrom: range.from, dateTo: range.to, category: '' });
  };

  const openAdd = () => {
    if (cashierCreateBlocked) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    setForm(emptyForm());
    setOpen(true);
    notify({ type: 'info', title: t('expenses.readOnlyNotice') });
  };

  const onStaffChange = (staffId: string) => {
    setForm((f) => ({ ...f, staff_id: staffId }));
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
    if (cashierCreateBlocked) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    if (isSalary && !form.staff_id) {
      notify({ type: 'warning', title: t('expenses.selectEmployee') });
      return;
    }
    if (form.fromKassa && !canTakeFromKassa) {
      notify({ type: 'warning', title: t('expenses.noOpenKassaForExpense') });
      return;
    }
    const body: Record<string, unknown> = {
      title: expenseTitle(form.title, form.category),
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      notes: form.notes || null,
      staff_id: isSalary ? form.staff_id : null,
      cash_register_session_id: form.fromKassa && openKassa ? openKassa.id : null,
    };
    try {
      await insert.mutateAsync(body);
      notify({ type: 'success', title: t('expenses.added') });
      setOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('expenses.title')}</h2>
        <Button onClick={openAdd} disabled={cashierCreateBlocked}>
          <Plus className="h-4 w-4" /> {t('expenses.add')}
        </Button>
      </div>
      {cashierCreateBlocked && <p className="text-sm text-amber-600">{t('kassa.openedByAnotherCashier')}</p>}

      <ListFilters
        value={filters}
        onChange={setFilters}
        onReset={resetFilters}
        searchPlaceholder={t('expenses.searchPlaceholder')}
        categoryOptions={CATEGORY_FILTER_OPTIONS}
        categoryLabel={t('expenses.category')}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => applyRange(todayRange())}>
          {t('filters.today')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => applyRange(yesterdayRange())}>
          {t('filters.yesterday')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => applyRange(lastDaysRange(7))}>
          {t('filters.last7Days')}
        </Button>
      </div>

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
          {paged.map((row) => (
            <Card
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <p className="min-w-0 flex-1 font-semibold">
                {expenseListHeading(row)}
                {row.cash_register_session_id && (
                  <span className="ml-2 text-xs font-medium text-amber-600">
                    {t('expenses.fromKassaBadge')}
                  </span>
                )}
              </p>
              <p className="shrink-0 text-sm text-slate-500">
                {row.category === 'SALARIES'
                  ? row.date
                  : `${expenseCategory(row.category)} · ${row.date}`}
              </p>
              <p className="shrink-0 text-lg font-bold tabular-nums text-red-600">
                {formatCurrency(Number(row.amount))}
              </p>
            </Card>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            {visibleCount > pageSize && (
              <Button size="sm" variant="ghost" onClick={() => setVisibleCount(pageSize)}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={visibleCount >= filtered.length}
              onClick={() => setVisibleCount((v) => Math.min(v + pageSize, filtered.length))}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('expenses.new')}>
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
            label={t('expenses.titleFieldOptional')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={expenseCategory(form.category)}
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
          {canTakeFromKassa && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.fromKassa}
                onChange={(e) => setForm({ ...form, fromKassa: e.target.checked })}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                <span className="font-medium">{t('expenses.fromKassa')}</span>
                <span className="mt-0.5 block text-slate-500">{t('expenses.fromKassaHint')}</span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={insert.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
