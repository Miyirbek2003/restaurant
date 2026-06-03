import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { t } from '@/i18n';

export type ListFiltersValue = {
  search: string;
  dateFrom: string;
  dateTo: string;
  category?: string;
};

type ListFiltersProps = {
  value: ListFiltersValue;
  onChange: (value: ListFiltersValue) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showDates?: boolean;
  categoryOptions?: { value: string; label: string }[];
  categoryLabel?: string;
  className?: string;
  beforeDates?: React.ReactNode;
  onReset?: () => void;
};

export function ListFilters({
  value,
  onChange,
  searchPlaceholder,
  showSearch = true,
  showDates = true,
  categoryOptions,
  categoryLabel,
  className = '',
  beforeDates,
  onReset,
}: ListFiltersProps) {
  const set = (patch: Partial<ListFiltersValue>) => onChange({ ...value, ...patch });

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end ${className}`}
    >
      {showSearch && (
        <div className="min-w-[12rem] flex-1 sm:max-w-xs">
          <Input
            label={t('filters.search')}
            placeholder={searchPlaceholder ?? t('filters.searchPlaceholder')}
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
      )}
      {beforeDates}
      {showDates && (
        <>
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Input
              label={t('filters.dateFrom')}
              type="date"
              value={value.dateFrom}
              onChange={(e) => set({ dateFrom: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Input
              label={t('filters.dateTo')}
              type="date"
              value={value.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
            />
          </div>
        </>
      )}
      {categoryOptions && categoryOptions.length > 0 && (
        <div className="w-full sm:w-auto sm:min-w-[10rem]">
          <Select
            label={categoryLabel ?? t('filters.category')}
            value={value.category ?? ''}
            onChange={(e) => set({ category: e.target.value })}
            options={categoryOptions}
          />
        </div>
      )}
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
