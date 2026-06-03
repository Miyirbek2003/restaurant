import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { lastDaysRange, todayRange, yesterdayRange } from '@/lib/filters';
import { t } from '@/i18n';

export type DateRangeValue = {
  dateFrom: string;
  dateTo: string;
};

type DateRangeToolbarProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  showQuickFilters?: boolean;
  showMonthSwitcher?: boolean;
  onReset?: () => void;
};

export function DateRangeToolbar({
  value,
  onChange,
  showQuickFilters = false,
  showMonthSwitcher = false,
  onReset,
}: DateRangeToolbarProps) {
  const shiftMonth = (delta: number) => {
    const base = value.dateFrom || format(new Date(), 'yyyy-MM-dd');
    const next = addMonths(parseISO(`${base.slice(0, 7)}-01`), delta);
    onChange({
      dateFrom: format(startOfMonth(next), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(next), 'yyyy-MM-dd'),
    });
  };

  const monthLabel = value.dateFrom
    ? format(parseISO(`${value.dateFrom.slice(0, 7)}-01`), 'LLLL yyyy')
    : format(new Date(), 'LLLL yyyy');

  const applyRange = (range: { from: string; to: string }) =>
    onChange({ dateFrom: range.from, dateTo: range.to });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
      {showMonthSwitcher && (
        <div className="flex shrink-0 items-center gap-1 self-center sm:self-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('filters.prevMonth')}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold capitalize">{monthLabel}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('filters.nextMonth')}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {showQuickFilters && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
      )}
      <div className="w-full min-w-[9rem] sm:w-auto">
        <Input
          label={t('filters.dateFrom')}
          type="date"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        />
      </div>
      <div className="w-full min-w-[9rem] sm:w-auto">
        <Input
          label={t('filters.dateTo')}
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
        />
      </div>
      {onReset && (
        <div className="flex w-full shrink-0 items-end sm:ml-auto sm:w-auto">
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            {t('filters.reset')}
          </Button>
        </div>
      )}
    </div>
  );
}
