import type { IncomeRow } from '@/hooks/useIncomes';

export type IncomePaymentLine = {
  method: string;
  amount: number;
};

export type IncomeByOrder = {
  key: string;
  order: IncomeRow['orders'];
  totalAmount: number;
  paidAt: string;
  payments: IncomePaymentLine[];
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  CLICK: 'Click',
  ONLINE: 'Онлайн',
};

export type PaymentMethodBadgeColor = 'green' | 'yellow' | 'blue' | 'gray' | 'red';

const METHOD_BADGE_COLOR: Record<string, PaymentMethodBadgeColor> = {
  CASH: 'green',
  CARD: 'blue',
  CLICK: 'yellow',
  ONLINE: 'gray',
};

const METHOD_ROW_CLASS: Record<string, string> = {
  CASH:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100',
  CARD: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100',
  CLICK:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
  ONLINE:
    'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-100',
};

const DEFAULT_ROW_CLASS =
  'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100';

export function paymentMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

export function paymentMethodBadgeColor(method: string): PaymentMethodBadgeColor {
  return METHOD_BADGE_COLOR[method] ?? 'gray';
}

export function paymentMethodRowClass(method: string): string {
  return METHOD_ROW_CLASS[method] ?? DEFAULT_ROW_CLASS;
}

/** 1 type → half width (1 of 2 cols); 2 → 2 cols; 3+ → 3 cols. */
export function paymentMethodsGridClass(count: number): string {
  if (count >= 3) return 'grid grid-cols-3 gap-2';
  return 'grid grid-cols-2 gap-2';
}

const METHOD_SORT_ORDER = ['CASH', 'CLICK', 'CARD', 'ONLINE'] as const;

function sortPaymentLines(lines: IncomePaymentLine[]): IncomePaymentLine[] {
  return [...lines].sort((a, b) => {
    const ai = METHOD_SORT_ORDER.indexOf(a.method as (typeof METHOD_SORT_ORDER)[number]);
    const bi = METHOD_SORT_ORDER.indexOf(b.method as (typeof METHOD_SORT_ORDER)[number]);
    const aRank = ai === -1 ? METHOD_SORT_ORDER.length : ai;
    const bRank = bi === -1 ? METHOD_SORT_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return b.amount - a.amount;
  });
}

/** Sum completed payment amounts by method for a period. */
export function sumIncomesByMethod(rows: IncomeRow[]): IncomePaymentLine[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.method, (map.get(row.method) ?? 0) + Number(row.amount));
  }
  return sortPaymentLines([...map.entries()].map(([method, amount]) => ({ method, amount })));
}

/** One income row per order (table visit); split payments are summed. */
export function groupIncomesByOrder(rows: IncomeRow[]): IncomeByOrder[] {
  const map = new Map<string, IncomeByOrder>();

  for (const row of rows) {
    const orderId = row.orders?.id;
    const key = orderId ?? `payment-${row.id}`;

    const amount = Number(row.amount);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        order: row.orders,
        totalAmount: amount,
        paidAt: row.created_at,
        payments: [{ method: row.method, amount }],
      });
      continue;
    }

    existing.totalAmount += amount;
    if (new Date(row.created_at).getTime() > new Date(existing.paidAt).getTime()) {
      existing.paidAt = row.created_at;
    }
    const sameMethod = existing.payments.find((p) => p.method === row.method);
    if (sameMethod) {
      sameMethod.amount += amount;
    } else {
      existing.payments.push({ method: row.method, amount });
    }
  }

  return [...map.values()]
    .map((row) => ({ ...row, payments: sortPaymentLines(row.payments) }))
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}
