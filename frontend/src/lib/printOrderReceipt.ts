import { format } from 'date-fns';
import type { OrderBill } from '@/lib/orderBilling';
import { SERVICE_FEE_RATE } from '@/lib/orderBilling';
import type { PaymentLine, PaymentMethod } from '@/lib/payments';
import { PAYMENT_METHOD_LABEL_KEYS } from '@/lib/payments';
import { formatCurrency } from '@/lib/utils';
import { t } from '@/i18n';

export type OrderReceiptData = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  orderNumber: number;
  tableName: string;
  waiterName: string;
  paidAt: Date;
  bill: OrderBill;
  payments: PaymentLine[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function paymentLabel(method: PaymentMethod): string {
  return t(PAYMENT_METHOD_LABEL_KEYS[method]);
}

function receiptStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Courier New", Courier, monospace;
      background: #fff;
      color: #000;
      padding: 16px;
    }
    .receipt {
      width: 72mm;
      max-width: 320px;
      margin: 0 auto;
      font-size: 11px;
      line-height: 1.35;
      text-transform: uppercase;
    }
    .center { text-align: center; }
    .logo {
      font-size: 28px;
      letter-spacing: 0.15em;
      margin-bottom: 8px;
    }
    .brand {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .meta {
      font-size: 10px;
      line-height: 1.45;
      margin-bottom: 10px;
    }
    .rule {
      border: 0;
      border-top: 1px solid #000;
      margin: 8px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .row span:last-child {
      white-space: nowrap;
      text-align: right;
    }
    .items .item {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 4px 0;
    }
    .items .name {
      flex: 1;
      text-transform: uppercase;
    }
    .items .price {
      white-space: nowrap;
    }
    .total-row {
      font-size: 13px;
      font-weight: 700;
      margin-top: 4px;
    }
    .payments {
      margin-top: 6px;
      font-size: 10px;
    }
    .footer {
      margin-top: 12px;
      font-size: 10px;
      line-height: 1.5;
    }
    .barcode {
      margin: 14px auto 4px;
      width: 180px;
      height: 48px;
      background:
        repeating-linear-gradient(
          90deg,
          #000 0,
          #000 2px,
          #fff 2px,
          #fff 4px
        );
    }
    .barcode-no {
      font-size: 10px;
      letter-spacing: 0.12em;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 4mm; size: 80mm auto; }
    }
  `;
}

export function buildOrderReceiptHtml(data: OrderReceiptData): string {
  const servicePct = Math.round(SERVICE_FEE_RATE * 100);
  const paidLabel = format(data.paidAt, 'dd/MM/yyyy HH:mm');
  const receiptCode = `${data.orderNumber}${format(data.paidAt, 'yyyyMMddHHmm')}`;
  const contactLines = [
    data.address?.trim(),
    data.phone?.trim() ? `${t('receipt.phone')}: ${data.phone.trim()}` : null,
    data.email?.trim(),
  ].filter(Boolean);

  const itemsHtml = data.bill.lines
    .map((line) => {
      const qtyPrefix = line.quantity > 1 ? `${line.quantity}× ` : '';
      return `<div class="item"><span class="name">${escapeHtml(qtyPrefix + line.name)}</span><span class="price">${escapeHtml(formatCurrency(line.lineTotal))}</span></div>`;
    })
    .join('');

  const paymentsHtml = data.payments
    .map(
      (p) =>
        `<div class="row"><span>${escapeHtml(paymentLabel(p.method))}</span><span>${escapeHtml(formatCurrency(p.amount))}</span></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t('receipt.title', { n: data.orderNumber }))}</title>
  <style>${receiptStyles()}</style>
</head>
<body>
  <div class="receipt">
    <div class="center logo">🍴</div>
    <div class="center brand">${escapeHtml(data.restaurantName)}</div>
    <div class="center meta">
      ${contactLines.map((line) => `<div>${escapeHtml(line!)}</div>`).join('')}
    </div>

    <hr class="rule" />

    <div class="row"><span>${escapeHtml(paidLabel)}</span></div>
    <div class="row">
      <span>${escapeHtml(t('receipt.number', { n: data.orderNumber }))}</span>
      <span>${escapeHtml(t('receipt.table', { name: data.tableName }))}</span>
    </div>
    <div class="row">
      <span>${escapeHtml(t('receipt.waiter', { name: data.waiterName }))}</span>
    </div>

    <hr class="rule" />

    <div class="items">${itemsHtml}</div>

    <hr class="rule" />

    <div class="row"><span>${escapeHtml(t('receipt.subtotal'))}</span><span>${escapeHtml(formatCurrency(data.bill.mealSubtotal))}</span></div>
    <div class="row"><span>${escapeHtml(t('receipt.serviceFee', { n: servicePct }))}</span><span>${escapeHtml(formatCurrency(data.bill.serviceFee))}</span></div>
    <div class="row total-row"><span>${escapeHtml(t('receipt.total'))}</span><span>${escapeHtml(formatCurrency(data.bill.grandTotal))}</span></div>

    ${
      paymentsHtml
        ? `<hr class="rule" /><div class="payments">${paymentsHtml}<div class="row"><span>${escapeHtml(t('receipt.status'))}</span><span>${escapeHtml(t('receipt.approved'))}</span></div></div>`
        : ''
    }

    <div class="center footer">
      <div>${escapeHtml(t('receipt.footerLine1'))}</div>
      <div>${escapeHtml(t('receipt.footerLine2'))}</div>
    </div>

    <div class="barcode" aria-hidden="true"></div>
    <div class="center barcode-no">${escapeHtml(receiptCode)}</div>
  </div>
</body>
</html>`;
}

export function printOrderReceipt(data: OrderReceiptData): void {
  const html = buildOrderReceiptHtml(data);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=420,height=720');
  if (!win) return;

  win.document.open();
  win.document.write(html);
  win.document.close();

  win.onload = () => {
    win.focus();
    win.print();
  };

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* popup blocked or already closed */
    }
  }, 250);
}
