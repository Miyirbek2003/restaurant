import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useIncomes } from '@/hooks/useIncomes';
import { formatCurrency } from '@/lib/utils';
import {
  groupIncomesByOrder,
  paymentMethodBadgeColor,
  paymentMethodLabel,
  paymentMethodRowClass,
  paymentMethodsGridClass,
  sumIncomesByMethod,
} from '@/lib/incomes';
import { cn } from '@/lib/utils';
import { defaultDateRangeMonth, lastDaysRange, matchesDateRange, matchesSearch, todayRange, yesterdayRange } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import { t } from '@/i18n';

export function IncomesPage() {
  const pageSize = 10;
  const { data = [], isLoading } = useIncomes();
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeMonth();
    return { search: '', dateFrom: range.from, dateTo: range.to };
  });

  const filteredPayments = useMemo(
    () =>
      data.filter((row) => {
        const order = row.orders;
        return (
          matchesDateRange(row.created_at, filters.dateFrom, filters.dateTo) &&
          matchesSearch(
            filters.search,
            String(order?.order_number ?? ''),
            order?.tables?.name,
            order?.staff?.name,
            row.reference,
            row.method,
          )
        );
      }),
    [data, filters],
  );

  const grouped = useMemo(() => groupIncomesByOrder(filteredPayments), [filteredPayments]);

  const totalIncome = useMemo(
    () => grouped.reduce((sum, row) => sum + row.totalAmount, 0),
    [grouped],
  );
  const totalsByMethod = useMemo(() => sumIncomesByMethod(filteredPayments), [filteredPayments]);
  const paymentCount = filteredPayments.length;
  const paged = useMemo(() => grouped.slice(0, visibleCount), [grouped, visibleCount]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filters.search, filters.dateFrom, filters.dateTo]);

  const applyRange = (range: { from: string; to: string }) =>
    setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to }));

  const resetFilters = () => {
    const range = defaultDateRangeMonth();
    setFilters({ search: '', dateFrom: range.from, dateTo: range.to });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('incomes.title')}</h2>
        <p className="text-sm text-slate-500">{t('incomes.subtitle')}</p>
      </div>

      <ListFilters
        value={filters}
        onChange={setFilters}
        onReset={resetFilters}
        searchPlaceholder={t('incomes.searchPlaceholder')}
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

      <Card className="space-y-4 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
        {totalsByMethod.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('incomes.byPaymentMethod')}
            </p>
            <div className={paymentMethodsGridClass(totalsByMethod.length)}>
              {totalsByMethod.map((line) => (
                <div
                  key={line.method}
                  className={cn(
                    'flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-2',
                    paymentMethodRowClass(line.method),
                  )}
                >
                  <span className="truncate text-sm font-medium">{paymentMethodLabel(line.method)}</span>
                  <span className="text-base font-bold tabular-nums">{formatCurrency(line.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('incomes.totalForPeriod')}</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{t('incomes.orderCount', { n: grouped.length })}</p>
            <p>{t('incomes.paymentCount', { n: paymentCount })}</p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : grouped.length === 0 ? (
        <EmptyState title={t('incomes.empty')} />
      ) : (
        <div className="space-y-3">
          {paged.map((row) => {
            const order = row.order;
            return (
              <Card key={row.key} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">
                      {formatCurrency(row.totalAmount)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(row.paidAt), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.payments.map((payment) => (
                      <Badge key={payment.method} color={paymentMethodBadgeColor(payment.method)} size="md">
                        {paymentMethodLabel(payment.method)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {order && (
                  <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="shrink-0 text-slate-500">{t('incomes.order')}</dt>
                      <dd className="font-medium">#{order.order_number}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="shrink-0 text-slate-500">{t('incomes.table')}</dt>
                      <dd>{order.tables?.name ?? t('common.takeaway')}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="shrink-0 text-slate-500">{t('incomes.waiter')}</dt>
                      <dd>{order.staff?.name ?? '—'}</dd>
                    </div>
                  </dl>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">{t('incomes.payments')}</p>
                  <div className={paymentMethodsGridClass(row.payments.length)}>
                    {row.payments.map((payment) => (
                      <div
                        key={payment.method}
                        className={cn(
                          'flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-sm',
                          paymentMethodRowClass(payment.method),
                        )}
                      >
                        <span className="truncate font-medium">{paymentMethodLabel(payment.method)}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            {visibleCount > pageSize && (
              <Button size="sm" variant="ghost" onClick={() => setVisibleCount(pageSize)}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={visibleCount >= grouped.length}
              onClick={() => setVisibleCount((v) => Math.min(v + pageSize, grouped.length))}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
