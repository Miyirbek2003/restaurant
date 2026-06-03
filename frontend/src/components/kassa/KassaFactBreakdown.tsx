import { paymentMethodLabel, paymentMethodRowClass } from '@/lib/incomes';
import { cn, formatCurrency } from '@/lib/utils';

type KassaFactBreakdownProps = {
  title?: string;
  cash: number;
  card: number;
  click: number;
  cashUnset?: boolean;
  className?: string;
};

const LINES = [
  { method: 'CASH', key: 'cash' as const },
  { method: 'CLICK', key: 'click' as const },
  { method: 'CARD', key: 'card' as const },
];

export function KassaFactBreakdown({ title, cash, card, click, cashUnset, className }: KassaFactBreakdownProps) {
  const amounts = { cash, card, click };

  return (
    <div className={className}>
      {title ? <p className="mb-1.5 text-xs font-medium text-slate-500">{title}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {LINES.map((line) => (
          <div
            key={line.method}
            className={cn(
              'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-center sm:text-left',
              paymentMethodRowClass(line.method),
            )}
          >
            <span className="text-xs font-medium">{paymentMethodLabel(line.method)}</span>
            <span className="text-sm font-bold tabular-nums">
              {line.key === 'cash' && cashUnset ? '—' : formatCurrency(amounts[line.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
