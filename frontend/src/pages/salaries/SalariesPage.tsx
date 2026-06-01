import { useMemo, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useExpensesList } from '@/hooks/useExpenses';
import { useEmployees } from '@/hooks/useEmployees';
import { formatCurrency } from '@/lib/utils';
import { matchesDateRange } from '@/lib/filters';
import { t } from '@/i18n';

function monthValue(d = new Date()) {
  return format(d, 'yyyy-MM');
}

export function SalariesPage() {
  const { data: expenses = [], isLoading: loadingExpenses } = useExpensesList();
  const { data: staff = [], isLoading: loadingStaff } = useEmployees();
  const [month, setMonth] = useState(monthValue());

  const monthFrom = `${month}-01`;
  const monthTo = format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd');

  const salaryExpenses = useMemo(
    () =>
      expenses.filter(
        (e) => e.category === 'SALARIES' && matchesDateRange(e.date, monthFrom, monthTo),
      ),
    [expenses, monthFrom, monthTo],
  );

  const totalPaid = useMemo(
    () => salaryExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [salaryExpenses],
  );

  const byStaff = useMemo(() => {
    const map = new Map<string, { name: string; total: number; payments: typeof salaryExpenses }>();
    for (const s of staff) {
      map.set(s.id, { name: s.name, total: 0, payments: [] });
    }
    for (const e of salaryExpenses) {
      const key = e.staff_id ?? '_unassigned';
      const name = e.staff?.name ?? t('salaries.unassigned');
      if (!map.has(key)) {
        map.set(key, { name, total: 0, payments: [] });
      }
      const row = map.get(key)!;
      row.total += Number(e.amount);
      row.payments.push(e);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [staff, salaryExpenses]);

  const isLoading = loadingExpenses || loadingStaff;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-title">{t('salaries.title')}</h2>
          <p className="text-sm text-slate-500">{t('salaries.subtitle')}</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('salaries.month')}
          </span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
      </div>

      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('salaries.totalMonth')}</p>
        <p className="text-2xl font-bold tabular-nums text-red-600">{formatCurrency(totalPaid)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {format(startOfMonth(parseISO(`${month}-01`)), 'MMMM yyyy')} ·{' '}
          {t('salaries.paymentCount', { n: salaryExpenses.length })}
        </p>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <section>
            <h3 className="mb-3 text-lg font-semibold">{t('salaries.byEmployee')}</h3>
            {byStaff.length === 0 ? (
              <p className="text-sm text-slate-500">{t('salaries.noPayments')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byStaff.map((row) => (
                  <Card key={row.name} className={row.total === 0 ? 'opacity-60' : ''}>
                    <p className="font-semibold">{row.name}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-red-600">
                      {formatCurrency(row.total)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('salaries.paymentCount', { n: row.payments.length })}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold">{t('salaries.paymentsList')}</h3>
            {salaryExpenses.length === 0 ? (
              <EmptyState title={t('salaries.noPayments')} />
            ) : (
              <div className="space-y-2">
                {salaryExpenses.map((e) => (
                  <Card key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-sm text-slate-500">
                        {e.staff?.name ?? t('salaries.unassigned')} · {e.date}
                      </p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-red-600">
                      {formatCurrency(Number(e.amount))}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
