import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { buildOrderBill, DEFAULT_SERVICE_FEE_RATE, type OrderBill } from '@/lib/orderBilling';
import { useServiceChargeRate } from '@/hooks/useRestaurantSettings';
import { resolveTableChargeAmount, tableHasCharge, type TableChargeFields } from '@/lib/tableCharge';
import {
  buildSplitFromPreset,
  PAYMENT_METHOD_LABEL_KEYS,
  paymentLinesValid,
  roundMoney,
  sumPaymentLines,
  type PaymentLine,
  type PaymentMethod,
  type SplitPresetId,
} from '@/lib/payments';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { formatSaleQuantity } from '@/lib/weight';

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  products?: { name: string; sale_unit?: string | null } | null;
};

type PayOrderModalProps = {
  open: boolean;
  onClose: () => void;
  orderNumber: number;
  tableName: string;
  items: OrderItem[];
  subtotal: number;
  table?: TableChargeFields | null;
  /** When the order was opened — used to auto-calculate hours for hourly tables. */
  startedAt?: string | Date | null;
  loading?: boolean;
  onConfirm: (grandTotal: number, payments: PaymentLine[], bill: OrderBill) => void;
  onPrintCheck?: (bill: OrderBill) => void;
  disablePrintCheck?: boolean;
};

/** Elapsed time since the order opened, rounded up to the next half hour (min 1h). */
function autoHoursFromStart(startedAt?: string | Date | null): number {
  if (!startedAt) return 1;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 1;
  const elapsedHours = (Date.now() - start) / 3_600_000;
  if (elapsedHours <= 0) return 1;
  return Math.max(1, Math.ceil(elapsedHours * 2) / 2);
}

function DottedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-slate-300 dark:border-slate-600" />
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
    </div>
  );
}

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'CLICK'];

export function PayOrderModal({
  open,
  onClose,
  orderNumber,
  tableName,
  items,
  subtotal,
  table,
  startedAt,
  loading,
  onConfirm,
  onPrintCheck,
  disablePrintCheck = false,
}: PayOrderModalProps) {
  const { data: serviceRate, isLoading: serviceRateLoading } = useServiceChargeRate();
  const resolvedServiceRate = serviceRate ?? (serviceRateLoading ? DEFAULT_SERVICE_FEE_RATE : 0);
  const isHourly = table?.charge_type === 'HOURLY';
  const [hours, setHours] = useState('1');

  const tableCharge = useMemo(() => {
    if (!tableHasCharge(table)) return 0;
    const h = isHourly ? parseFloat(hours) || 0 : 1;
    return resolveTableChargeAmount(table, h);
  }, [table, isHourly, hours]);

  const bill = useMemo(
    () => buildOrderBill(items, subtotal, resolvedServiceRate, tableCharge),
    [items, subtotal, resolvedServiceRate, tableCharge],
  );
  const servicePct = Math.round(bill.serviceRate * 100);

  const [preset, setPreset] = useState<SplitPresetId>('single');
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('CASH');
  const [customLines, setCustomLines] = useState<PaymentLine[]>([
    { method: 'CASH', amount: 0 },
    { method: 'CLICK', amount: 0 },
  ]);

  useEffect(() => {
    if (!open) return;
    setPreset('single');
    setSingleMethod('CASH');
    setCustomLines([
      { method: 'CASH', amount: 0 },
      { method: 'CLICK', amount: 0 },
    ]);
  }, [open, bill.grandTotal]);

  // Auto-fill table hours from how long the order has been open (hourly tables).
  useEffect(() => {
    if (!open) return;
    setHours(String(autoHoursFromStart(startedAt)));
  }, [open, startedAt]);

  const paymentLines = useMemo((): PaymentLine[] => {
    if (preset === 'custom') {
      return customLines.filter((l) => l.amount > 0);
    }
    return buildSplitFromPreset(preset, bill.grandTotal, singleMethod);
  }, [preset, singleMethod, customLines, bill.grandTotal]);

  const linesPreview = useMemo(() => {
    if (preset === 'custom') return customLines;
    return buildSplitFromPreset(preset, bill.grandTotal, singleMethod);
  }, [preset, singleMethod, customLines, bill.grandTotal]);

  const updateCustomAmount = (index: number, raw: string) => {
    const amount = Math.max(0, roundMoney(parseFloat(raw) || 0));
    setCustomLines((prev) => {
      const next = prev.map((line, i) => (i === index ? { ...line, amount } : line));
      if (next.length === 2) {
        const other = index === 0 ? 1 : 0;
        const remain = Math.max(0, roundMoney(bill.grandTotal - amount));
        next[other] = { ...next[other], amount: remain };
      }
      return next;
    });
  };

  const removeCustomLine = (index: number) => {
    if (index < 2) return;
    setCustomLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  const valid = paymentLinesValid(paymentLines, bill.grandTotal);

  const tableChargeLabel =
    table?.charge_type === 'HOURLY'
      ? t('payModal.tableChargeHourly', { n: hours })
      : t('payModal.tableChargeOnce');

  return (
    <Modal open={open} onClose={onClose} title={t('payModal.title', { n: orderNumber })} className="max-w-md">
      <p className="mb-4 text-sm text-slate-500">{tableName}</p>

      <div className="space-y-2">
        {bill.lines.map((line) => {
          const qtyLabel =
            line.saleUnit === 'KG'
              ? formatSaleQuantity(line.quantity, 'KG')
              : line.quantity > 1
                ? `${line.quantity}×`
                : '';
          return (
            <DottedRow
              key={line.id}
              label={qtyLabel ? `${qtyLabel} ${line.name}` : line.name}
              value={formatCurrency(line.lineTotal)}
            />
          );
        })}
      </div>

      <hr className="my-4 border-slate-200 dark:border-slate-700" />

      <div className="space-y-2">
        <DottedRow label={t('payModal.mealTotal')} value={formatCurrency(bill.mealSubtotal)} />
        {bill.tableCharge > 0 && (
          <DottedRow label={tableChargeLabel} value={formatCurrency(bill.tableCharge)} />
        )}
        <DottedRow label={t('payModal.serviceFee', { n: servicePct })} value={formatCurrency(bill.serviceFee)} />
        {bill.serviceRate === 0 && (
          <p className="text-xs text-slate-500">{t('orders.serviceFeeZeroHint')}</p>
        )}
      </div>

      {isHourly && tableHasCharge(table) && (
        <div className="mt-4">
          <Input
            label={t('payModal.tableHours')}
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{t('payModal.tableHoursAuto')}</p>
        </div>
      )}

      <hr className="my-4 border-slate-900 dark:border-slate-100" />

      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-lg font-bold">{t('payModal.total')}</span>
        <span className="text-xl font-bold tabular-nums">{formatCurrency(bill.grandTotal)}</span>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-medium">{t('payModal.paymentType')}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['single', t('payModal.presetSingle')],
              ['custom', t('payModal.presetCustom')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                preset === id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600',
              )}
              onClick={() => setPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'single' && (
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={cn(
                  'rounded-lg py-2 text-sm font-medium transition',
                  singleMethod === m
                    ? 'bg-primary-600 text-white'
                    : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-600',
                )}
                onClick={() => setSingleMethod(m)}
              >
                {t(PAYMENT_METHOD_LABEL_KEYS[m])}
              </button>
            ))}
          </div>
        )}

        {preset === 'custom' && (
          <div className="space-y-2">
            {customLines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={line.method}
                  onChange={(e) => {
                    const method = e.target.value as PaymentMethod;
                    setCustomLines((prev) => prev.map((l, i) => (i === idx ? { ...l, method } : l)));
                  }}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(PAYMENT_METHOD_LABEL_KEYS[m])}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-28 shrink-0"
                  value={line.amount || ''}
                  onChange={(e) => updateCustomAmount(idx, e.target.value)}
                />
                {idx >= 2 && (
                  <button
                    type="button"
                    className="shrink-0 rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => removeCustomLine(idx)}
                    aria-label={t('payModal.removeLine')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setCustomLines((prev) => [...prev, { method: 'CARD', amount: 0 }])}
            >
              {t('payModal.addLine')}
            </Button>
          </div>
        )}

        <div className="space-y-1 border-t border-slate-200 pt-2 text-sm dark:border-slate-600">
          {linesPreview
            .filter((l) => l.amount > 0 || preset !== 'custom')
            .map((line, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-500">
                  {t(PAYMENT_METHOD_LABEL_KEYS[line.method])}
                </span>
                <span className="font-medium tabular-nums">{formatCurrency(line.amount)}</span>
              </div>
            ))}
          <div className="flex justify-between font-semibold">
            <span>{t('payModal.splitSum')}</span>
            <span
              className={cn(
                'tabular-nums',
                Math.abs(sumPaymentLines(linesPreview) - bill.grandTotal) < 0.01
                  ? 'text-emerald-600'
                  : 'text-red-600',
              )}
            >
              {formatCurrency(sumPaymentLines(linesPreview))}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        {onPrintCheck && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onPrintCheck?.(bill)}
            disabled={loading || disablePrintCheck}
          >
            {t('payModal.printCheck')}
          </Button>
        )}
        <Button
          type="button"
          loading={loading}
          disabled={!valid || loading}
          onClick={() => onConfirm(bill.grandTotal, paymentLines, bill)}
        >
          {t('payModal.pay')}
        </Button>
      </div>
    </Modal>
  );
}
