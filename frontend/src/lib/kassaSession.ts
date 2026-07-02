import type { CashRegisterSession } from '@/hooks/useCashRegister';

export function sessionDrawerTotals(
  session: Pick<
    CashRegisterSession,
    | 'expected_cash'
    | 'expected_card'
    | 'expected_click'
    | 'counted_cash'
    | 'counted_card'
    | 'counted_click'
  >,
  kassaExpensesTotal: number,
) {
  const expectedTotal =
    Number(session.expected_cash) + Number(session.expected_card) + Number(session.expected_click);
  const expectedAfterExpenses = Math.max(0, expectedTotal - kassaExpensesTotal);
  const factTotal =
    Number(session.counted_cash ?? 0) +
    Number(session.counted_card ?? 0) +
    Number(session.counted_click ?? 0);
  const diff = factTotal - expectedAfterExpenses;

  return {
    expectedAfterExpenses,
    factTotal,
    shortage: diff < 0 ? Math.abs(diff) : 0,
    excess: diff > 0 ? diff : 0,
  };
}
