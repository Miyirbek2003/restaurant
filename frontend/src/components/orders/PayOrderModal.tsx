import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { buildOrderBill, SERVICE_FEE_RATE } from '@/lib/orderBilling';

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  products?: { name: string } | null;
};

type PayOrderModalProps = {
  open: boolean;
  onClose: () => void;
  orderNumber: number;
  tableName: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  loading?: boolean;
  onConfirm: (grandTotal: number) => void;
};

function DottedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-slate-300 dark:border-slate-600" />
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function PayOrderModal({
  open,
  onClose,
  orderNumber,
  tableName,
  items,
  subtotal,
  taxAmount,
  loading,
  onConfirm,
}: PayOrderModalProps) {
  const bill = buildOrderBill(items, subtotal, taxAmount);
  const servicePct = Math.round(SERVICE_FEE_RATE * 100);

  return (
    <Modal open={open} onClose={onClose} title={`Pay order #${orderNumber}`} className="max-w-md">
      <p className="mb-4 text-sm text-slate-500">{tableName}</p>

      <div className="space-y-2">
        {bill.lines.map((line) => (
          <DottedRow
            key={line.id}
            label={`${line.quantity > 1 ? `${line.quantity}× ` : ''}${line.name}`}
            value={formatCurrency(line.lineTotal)}
          />
        ))}
      </div>

      <hr className="my-4 border-slate-200 dark:border-slate-700" />

      <div className="space-y-2">
        <DottedRow label="Total for meal" value={formatCurrency(bill.mealSubtotal)} />
        {bill.taxAmount > 0 && (
          <DottedRow label="Tax" value={formatCurrency(bill.taxAmount)} />
        )}
        <DottedRow label={`Service fee (${servicePct}%)`} value={formatCurrency(bill.serviceFee)} />
      </div>

      <hr className="my-4 border-slate-900 dark:border-slate-100" />

      <div className="mb-6 flex items-baseline justify-between">
        <span className="text-lg font-bold">TOTAL</span>
        <span className="text-xl font-bold tabular-nums">{formatCurrency(bill.grandTotal)}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" loading={loading} onClick={() => onConfirm(bill.grandTotal)}>
          Pay
        </Button>
      </div>
    </Modal>
  );
}
