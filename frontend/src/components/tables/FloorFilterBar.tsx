import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FLOOR_FILTER_ALL, type FloorFilter } from '@/lib/floors';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

type FloorFilterBarProps = {
  floors: string[];
  floorFilter: FloorFilter;
  floorCounts: Record<string, number>;
  canManage: boolean;
  onFilterChange: (filter: FloorFilter) => void;
  onManageFloors: () => void;
};

export function FloorFilterBar({
  floors,
  floorFilter,
  floorCounts,
  canManage,
  onFilterChange,
  onManageFloors,
}: FloorFilterBarProps) {
  const items: { key: FloorFilter; label: string; count: number }[] = [
    { key: FLOOR_FILTER_ALL, label: t('tables.allFloors'), count: floorCounts[FLOOR_FILTER_ALL] ?? 0 },
    ...floors.map((f) => ({ key: f, label: f, count: floorCounts[f] ?? 0 })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
        role="tablist"
        aria-label={t('tables.floorFilter')}
      >
        {items.map(({ key, label, count }) => {
          const active = floorFilter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(key)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-sm font-medium transition',
                active
                  ? 'bg-primary-600 font-semibold text-white shadow-md ring-2 ring-primary-600/30 ring-offset-1 ring-offset-slate-100 dark:bg-primary-500 dark:ring-primary-400/40 dark:ring-offset-slate-800'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200',
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  active ? 'text-white/90' : 'text-slate-400',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {canManage && (
        <Button size="sm" variant="secondary" onClick={onManageFloors}>
          <Layers className="h-4 w-4" />
          {t('tables.manageFloors')}
        </Button>
      )}
    </div>
  );
}
