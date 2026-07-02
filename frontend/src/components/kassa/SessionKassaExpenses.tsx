import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionKassaExpenses } from '@/hooks/useCashRegister';
import { formatCurrency } from '@/lib/utils';
import { t, expenseCategory } from '@/i18n';

export function SessionKassaExpenses({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const { data: expenses = [], isLoading } = useSessionKassaExpenses(sessionId, true);
  const total = expenses.reduce((sum, row) => sum + Number(row.amount), 0);

  if (!isLoading && expenses.length === 0) return null;

  return (
    <div className="border-t border-slate-200 pt-1.5 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {t('kassa.sessionExpenses')}
        {!open && !isLoading && total > 0 && (
          <span className="ml-auto tabular-nums text-red-600">−{formatCurrency(total)}</span>
        )}
      </button>
      {open && (
        <div className="mt-1.5">
          {isLoading ? (
            <Spinner />
          ) : expenses.length === 0 ? (
            <p className="text-xs text-slate-500">{t('kassa.noSessionExpenses')}</p>
          ) : (
            <>
              <ul className="space-y-1 text-xs">
                {expenses.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800"
                  >
                    <span className="truncate">{row.title || expenseCategory(row.category)}</span>
                    <span className="shrink-0 tabular-nums text-red-600">
                      −{formatCurrency(Number(row.amount))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 flex justify-between text-xs font-semibold">
                <span>{t('kassa.sessionExpensesTotal')}</span>
                <span className="tabular-nums text-red-600">−{formatCurrency(total)}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
