export type PaymentMethod = 'CASH' | 'CARD' | 'CLICK';

export type PaymentLine = {
  method: PaymentMethod;
  amount: number;
};

export type SplitPresetId = 'single' | 'cash30_click70' | 'click40_card60' | 'custom';

export const PAYMENT_METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
  CASH: 'payModal.methodCash',
  CARD: 'payModal.methodCard',
  CLICK: 'payModal.methodClick',
};

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSplitFromPreset(presetId: SplitPresetId, total: number, singleMethod: PaymentMethod): PaymentLine[] {
  const t = roundMoney(total);
  if (t <= 0) return [];

  if (presetId === 'single') {
    return [{ method: singleMethod, amount: t }];
  }
  if (presetId === 'cash30_click70') {
    const cash = roundMoney(t * 0.3);
    const click = roundMoney(t - cash);
    return [
      { method: 'CASH', amount: cash },
      { method: 'CLICK', amount: click },
    ];
  }
  if (presetId === 'click40_card60') {
    const click = roundMoney(t * 0.4);
    const card = roundMoney(t - click);
    return [
      { method: 'CLICK', amount: click },
      { method: 'CARD', amount: card },
    ];
  }
  return [{ method: singleMethod, amount: t }];
}

export function sumPaymentLines(lines: PaymentLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.amount, 0));
}

export function paymentLinesValid(lines: PaymentLine[], expectedTotal: number): boolean {
  if (lines.length === 0) return false;
  if (lines.some((l) => l.amount <= 0)) return false;
  return Math.abs(sumPaymentLines(lines) - roundMoney(expectedTotal)) < 0.01;
}
