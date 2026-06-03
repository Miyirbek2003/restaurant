import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn, formatCurrency } from '@/lib/utils';
import { DateRangeToolbar } from '@/components/ui/DateRangeToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { useExpensesList } from '@/hooks/useExpenses';
import { useEmployees } from '@/hooks/useEmployees';
import { defaultDateRangeMonth, matchesDateRange } from '@/lib/filters';
import { groupSalariesByMonth, type StaffSalaryRow } from '@/lib/salaries';
import { t, expenseCategory } from '@/i18n';

function EmployeeSalaryRow({ row }: { row: StaffSalaryRow }) {
  const [open, setOpen] = useState(false);
  const canExpand = row.paymentCount > 0;

  return (
    <li className={row.total === 0 ? 'opacity-50' : undefined}>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 px-4 py-3 text-left',
          canExpand && 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
        )}
        onClick={() => canExpand && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!canExpand}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            !canExpand && 'opacity-0',
            open && 'rotate-180',
          )}
        />
        <span className="min-w-0 flex-1 font-medium">{row.name}</span>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums text-red-600">{formatCurrency(row.total)}</p>
          <p className="text-xs text-slate-500">
            {t('salaries.paymentCount', { n: row.paymentCount })}
          </p>
        </div>
      </button>
      {open && canExpand && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 pl-10 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="mb-1.5 text-xs font-medium text-slate-500">{t('salaries.paymentHistory')}</p>
          <ul className="space-y-1.5">
            {row.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-slate-600 dark:text-slate-400">
                  {format(parseISO(payment.date), 'dd.MM.yyyy')}
                  {' · '}
                  {payment.title?.trim() || expenseCategory(payment.category)}
                </span>
                <span className="font-semibold tabular-nums text-red-600">
                  {formatCurrency(Number(payment.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function StaffSalaryList({ rows }: { rows: StaffSalaryRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-500">{t('salaries.noPayments')}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => (
        <EmployeeSalaryRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

export function SalariesPage() {
  const { data: expenses = [], isLoading: loadingExpenses } = useExpensesList();
  const { data: staff = [], isLoading: loadingStaff } = useEmployees();
  const resetDateRange = () => {
    const month = defaultDateRangeMonth();
    setDateRange({ dateFrom: month.from, dateTo: month.to });
  };

  const [dateRange, setDateRange] = useState(() => {
    const month = defaultDateRangeMonth();
    return { dateFrom: month.from, dateTo: month.to };
  });

  const salaryExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.category === 'SALARIES' &&
          matchesDateRange(e.date, dateRange.dateFrom, dateRange.dateTo),
      ),
    [expenses, dateRange.dateFrom, dateRange.dateTo],
  );

  const periodLabel = useMemo(() => {
    const { dateFrom, dateTo } = dateRange;
    if (!dateFrom && !dateTo) return t('salaries.allPeriod');
    if (dateFrom && dateTo) {
      return `${format(parseISO(dateFrom), 'd MMM yyyy')} — ${format(parseISO(dateTo), 'd MMM yyyy')}`;
    }
    if (dateFrom) return `${t('filters.dateFrom')} ${format(parseISO(dateFrom), 'd MMM yyyy')}`;
    return `${t('filters.dateTo')} ${format(parseISO(dateTo), 'd MMM yyyy')}`;
  }, [dateRange]);

  const salaryByMonth = useMemo(
    () =>
      groupSalariesByMonth(
        salaryExpenses,
        staff,
        dateRange.dateFrom,
        dateRange.dateTo,
        t('salaries.unassigned'),
      ),
    [salaryExpenses, staff, dateRange.dateFrom, dateRange.dateTo],
  );

  const totalPaid = useMemo(
    () => salaryExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [salaryExpenses],
  );

  const isLoading = loadingExpenses || loadingStaff;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('salaries.title')}</h2>
        <p className="text-sm text-slate-500">{t('salaries.subtitle')}</p>
      </div>

      <DateRangeToolbar
        value={dateRange}
        onChange={setDateRange}
        showMonthSwitcher
        onReset={resetDateRange}
      />

      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('salaries.totalMonth')}</p>
        <p className="text-2xl font-bold tabular-nums text-red-600">{formatCurrency(totalPaid)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {periodLabel} · {t('salaries.paymentCount', { n: salaryExpenses.length })}
        </p>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">{t('salaries.byEmployee')}</h3>
          {salaryByMonth.length === 0 ? (
            <p className="text-sm text-slate-500">{t('salaries.noPayments')}</p>
          ) : (
            salaryByMonth.map((month) => (
              <Card key={month.key} className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-lg font-semibold capitalize text-slate-800 dark:text-slate-100">
                    {month.title}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-red-600">
                    {formatCurrency(month.monthTotal)}
                  </p>
                </div>
                <StaffSalaryList rows={month.staffRows} />
              </Card>
            ))
          )}
        </section>
      )}
    </div>
  );
}
