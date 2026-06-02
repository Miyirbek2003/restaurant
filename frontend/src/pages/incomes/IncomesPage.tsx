import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useIncomes } from '@/hooks/useIncomes';
import { formatCurrency } from '@/lib/utils';
import { defaultDateRangeMonth, lastDaysRange, matchesDateRange, matchesSearch, todayRange, yesterdayRange } from '@/lib/filters';
import { ListFilters, type ListFiltersValue } from '@/components/ui/ListFilters';
import { t } from '@/i18n';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  ONLINE: 'Онлайн',
};

export function IncomesPage() {
  const pageSize = 10;
  const { data = [], isLoading } = useIncomes();
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [filters, setFilters] = useState<ListFiltersValue>(() => {
    const range = defaultDateRangeMonth();
    return { search: '', dateFrom: range.from, dateTo: range.to };
  });

  const filtered = useMemo(
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

  const totalIncome = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.amount), 0),
    [filtered],
  );
  const paged = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filters.search, filters.dateFrom, filters.dateTo]);

  const applyRange = (range: { from: string; to: string }) =>
    setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('incomes.title')}</h2>
        <p className="text-sm text-slate-500">{t('incomes.subtitle')}</p>
      </div>

      <ListFilters
        value={filters}
        onChange={setFilters}
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

      <Card className="flex flex-wrap items-center justify-between gap-4 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('incomes.totalForPeriod')}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <p className="text-sm text-slate-500">{t('incomes.paymentCount', { n: filtered.length })}</p>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('incomes.empty')} />
      ) : (
        <div className="space-y-3">
          {paged.map((row) => {
            const order = row.orders;
            return (
              <Card key={row.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">
                      {formatCurrency(Number(row.amount))}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(row.created_at), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge color="green" size="sm">
                      {METHOD_LABELS[row.method] ?? row.method}
                    </Badge>
                    <Badge color="gray" size="sm">
                      {row.status}
                    </Badge>
                  </div>
                </div>
                {order && (
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">{t('incomes.order')}</dt>
                      <dd className="font-medium">#{order.order_number}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t('incomes.table')}</dt>
                      <dd>{order.tables?.name ?? t('common.takeaway')}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t('incomes.waiter')}</dt>
                      <dd>{order.staff?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t('incomes.orderTotal')}</dt>
                      <dd>{formatCurrency(Number(order.total))}</dd>
                    </div>
                  </dl>
                )}
                {row.reference && (
                  <p className="text-xs text-slate-500">
                    {t('incomes.reference')}: {row.reference}
                  </p>
                )}
              </Card>
            );
          })}
          <div className="flex justify-center pt-2">
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
    </div>
  );
}
