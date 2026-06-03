import { orderItemName, type OrderItemNameSource } from '@/lib/orderItem';

export const SERVICE_FEE_RATE = 0.1;

export type BillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderBill = {
  lines: BillLine[];
  mealSubtotal: number;
  taxAmount: number;
  serviceFee: number;
  grandTotal: number;
};

type OrderItemRow = OrderItemNameSource & {
  id: string;
  quantity: number;
  unit_price: number;
  products?: { name: string } | null;
};

export function buildOrderBill(
  items: OrderItemRow[],
  orderSubtotal: number,
  _orderTax = 0,
  serviceRate = SERVICE_FEE_RATE,
): OrderBill {
  const lines: BillLine[] = items.map((item) => {
    const unitPrice = Number(item.unit_price);
    const quantity = item.quantity;
    const lineTotal = unitPrice * quantity;
    return {
      id: item.id,
      name: orderItemName(item, 'Item'),
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const mealSubtotal = lines.length > 0
    ? lines.reduce((s, l) => s + l.lineTotal, 0)
    : Number(orderSubtotal);

  const serviceFee = mealSubtotal * serviceRate;
  const grandTotal = mealSubtotal + serviceFee;

  return { lines, mealSubtotal, taxAmount: 0, serviceFee, grandTotal };
}
