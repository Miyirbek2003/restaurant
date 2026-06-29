import { orderItemName, type OrderItemNameSource } from '@/lib/orderItem';

/** Fallback only when restaurant has no settings row yet. */
export const DEFAULT_SERVICE_FEE_RATE = 0.1;
export const DEFAULT_SERVICE_FEE_PERCENT = 10;
/** @deprecated Use DEFAULT_SERVICE_FEE_RATE or useServiceChargeSettings(). */
export const SERVICE_FEE_RATE = DEFAULT_SERVICE_FEE_RATE;

export type TableChargeType = 'NONE' | 'HOURLY' | 'ONE_TIME';

export function serviceChargePercentFromSettings(
  dbPercent: number | null | undefined,
  settingsExist: boolean,
): number {
  if (!settingsExist) return DEFAULT_SERVICE_FEE_PERCENT;
  return Math.max(0, Number(dbPercent ?? 0));
}

export function serviceChargeRateFromSettings(
  dbPercent: number | null | undefined,
  settingsExist: boolean,
): number {
  return serviceChargePercentFromSettings(dbPercent, settingsExist) / 100;
}

export function computeTableCharge(
  type: TableChargeType | string | null | undefined,
  amount: number,
  hours = 1,
): number {
  const rate = Math.max(0, Number(amount) || 0);
  if (type === 'ONE_TIME') return rate;
  if (type === 'HOURLY') return rate * Math.max(0, hours);
  return 0;
}

export type BillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  saleUnit: BillSaleUnit;
};

export type OrderBill = {
  lines: BillLine[];
  mealSubtotal: number;
  serviceFee: number;
  tableCharge: number;
  grandTotal: number;
  serviceRate: number;
};

type OrderItemRow = OrderItemNameSource & {
  id: string;
  quantity: number;
  unit_price: number;
  products?: { name: string; sale_unit?: string | null } | null;
};

export type BillSaleUnit = 'PIECE' | 'KG';

export function buildOrderBill(
  items: OrderItemRow[],
  orderSubtotal: number,
  serviceRate = DEFAULT_SERVICE_FEE_RATE,
  tableCharge = 0,
): OrderBill {
  const lines: BillLine[] = items.map((item) => {
    const unitPrice = Number(item.unit_price);
    const quantity = item.quantity;
    const lineTotal = unitPrice * quantity;
    const saleUnit: BillSaleUnit = item.products?.sale_unit === 'KG' ? 'KG' : 'PIECE';
    return {
      id: item.id,
      name: orderItemName(item, 'Item'),
      quantity,
      unitPrice,
      lineTotal,
      saleUnit,
    };
  });

  const mealSubtotal = lines.length > 0
    ? lines.reduce((s, l) => s + l.lineTotal, 0)
    : Number(orderSubtotal);

  const serviceFee = mealSubtotal * serviceRate;
  const safeTableCharge = Math.max(0, Number(tableCharge) || 0);
  const grandTotal = mealSubtotal + serviceFee + safeTableCharge;

  return {
    lines,
    mealSubtotal,
    serviceFee,
    tableCharge: safeTableCharge,
    grandTotal,
    serviceRate,
  };
}
