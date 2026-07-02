import { useSessionKassaExpenses, type CashRegisterSession } from '@/hooks/useCashRegister';
import { sessionDrawerTotals } from '@/lib/kassaSession';
import { formatCurrency } from '@/lib/utils';
import { t } from '@/i18n';

export function SessionShortage({ session }: { session: CashRegisterSession }) {
  const stored = Number(session.kassa_expenses_total ?? 0);
  const { data: expenses = [] } = useSessionKassaExpenses(session.id, stored <= 0);
  const expensesTotal =
    stored > 0 ? stored : expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const { shortage, excess } = sessionDrawerTotals(session, expensesTotal);

  if (shortage <= 0 && excess <= 0) return null;

  return (
    <div className="space-y-0.5 text-right text-xs font-semibold">
      {shortage > 0 && (
        <p className="text-red-600 dark:text-red-400">
          {t('kassa.shortage')}: {formatCurrency(shortage)}
        </p>
      )}
      {excess > 0 && (
        <p className="text-emerald-600 dark:text-emerald-400">
          {t('kassa.excess')}: {formatCurrency(excess)}
        </p>
      )}
    </div>
  );
}
