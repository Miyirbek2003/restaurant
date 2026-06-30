import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionSoldItems } from '@/hooks/useCashRegister';
import { t } from '@/i18n';

export function SessionSoldItems({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useSessionSoldItems(sessionId, open);

  return (
    <div className="border-t border-slate-200 pt-1.5 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {t('kassa.soldItems')}
      </button>
      {open && (
        <div className="mt-1.5">
          {isLoading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-500">{t('kassa.noSoldItems')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.productId ?? item.name}
                  className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">×{item.quantitySold}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
