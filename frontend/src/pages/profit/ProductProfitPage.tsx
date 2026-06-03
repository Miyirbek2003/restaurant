import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateRangeToolbar } from '@/components/ui/DateRangeToolbar';
import { useProductProfitReport } from '@/hooks/useProductProfit';
import { displayMarginPct, displayProfit, sumProductProfit } from '@/lib/productProfit';
import { defaultDateRangeMonth, matchesSearch } from '@/lib/filters';
import { cn, formatCurrency } from '@/lib/utils';
import { t } from '@/i18n';

function ProfitCell({ value, emphasize }: { value: number; emphasize?: boolean }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        emphasize && 'font-semibold',
        emphasize && value > 0 && 'text-violet-700 dark:text-violet-400',
        emphasize && value < 0 && 'text-red-600',
        emphasize && value === 0 && 'text-slate-500',
        !emphasize && value > 0 && 'text-emerald-600',
        !emphasize && value < 0 && 'text-red-600',
        !emphasize && value === 0 && 'text-slate-500',
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

export function ProductProfitPage() {
  const [dateRange, setDateRange] = useState(() => {
    const month = defaultDateRangeMonth();
    return { dateFrom: month.from, dateTo: month.to };
  });
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useProductProfitReport(
    dateRange.dateFrom,
    dateRange.dateTo,
  );

  const filtered = useMemo(() => {
    const list = rows.filter((row) =>
      matchesSearch(search, row.name, row.categoryName || t('productProfit.noCategory')),
    );
    return [...list].sort((a, b) => {
      const diff = displayProfit(b) - displayProfit(a);
      if (diff !== 0) return diff;
      return b.unitProfit - a.unitProfit;
    });
  }, [rows, search]);

  const totals = useMemo(() => sumProductProfit(filtered), [filtered]);

  const resetDateRange = () => {
    const month = defaultDateRangeMonth();
    setDateRange({ dateFrom: month.from, dateTo: month.to });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('productProfit.title')}</h2>
        <p className="text-sm text-slate-500">{t('productProfit.subtitle')}</p>
      </div>

      <DateRangeToolbar
        value={dateRange}
        onChange={setDateRange}
        showMonthSwitcher
        onReset={resetDateRange}
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('productProfit.searchPlaceholder')}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('productProfit.totalRevenue')}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(totals.revenue)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('productProfit.totalCost')}</p>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(totals.cost)}</p>
        </Card>
        <Card className="border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-sm text-violet-800/80 dark:text-violet-300/80">{t('productProfit.totalProfit')}</p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums',
              totals.profit >= 0 ? 'text-violet-700 dark:text-violet-400' : 'text-red-600',
            )}
          >
            {formatCurrency(totals.profit)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('productProfit.soldUnits', { n: totals.quantitySold })}</p>
        </Card>
      </div>

      <p className="text-xs text-slate-500">{t('productProfit.costHint')}</p>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title={search ? t('filters.noResults') : t('productProfit.empty')} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3">{t('productProfit.colName')}</th>
                  <th className="px-4 py-3">{t('productProfit.colCategory')}</th>
                  <th className="px-4 py-3 text-right">{t('productProfit.colQty')}</th>
                  <th className="px-4 py-3 text-right">{t('productProfit.colRevenue')}</th>
                  <th className="px-4 py-3 text-right">{t('productProfit.colCost')}</th>
                  <th className="px-4 py-3 text-right">{t('productProfit.colProfit')}</th>
                  <th className="px-4 py-3 text-right">{t('productProfit.colMargin')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((row) => {
                  const shownProfit = displayProfit(row);
                  const shownMargin = displayMarginPct(row);
                  return (
                  <tr key={row.key}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">
                      <Badge color="gray" size="sm">
                        {row.categoryName || t('productProfit.noCategory')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.quantitySold}</td>
                    <td className="px-4 py-3 text-right">
                      <ProfitCell value={row.revenue} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ProfitCell value={row.cost} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ProfitCell value={shownProfit} emphasize />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {shownMargin != null ? `${shownMargin.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
