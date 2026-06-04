import { buildOrderBill } from '@/lib/orderBilling';
import { resolveTableChargeAmount } from '@/lib/tableCharge';
import type { OrderStatus } from '@/types';

export type OrderCardTotalsInput = {
  status: OrderStatus;
  subtotal: number;
  discount_amount?: number;
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    products?: { name: string } | null;
  }[];
  tables?: { charge_type?: string; charge_amount?: number } | null;
};

export type OrderCardTotals = {
  subtotal: number;
  serviceFee: number;
  servicePct: number;
  tableCharge: number;
  discount: number;
  displayTotal: number;
  showServiceLine: boolean;
};

export function computeOrderCardTotals(
  order: OrderCardTotalsInput,
  serviceRate: number,
): OrderCardTotals {
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount_amount ?? 0);

  const items =
    order.order_items?.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      products: item.products ?? null,
    })) ?? [];

  const tableCharge = resolveTableChargeAmount(order.tables, 1);
  const bill = buildOrderBill(items, subtotal, serviceRate, tableCharge);
  const displayTotal = Math.max(0, bill.grandTotal - discount);

  return {
    subtotal,
    serviceFee: bill.serviceFee,
    servicePct: Math.round(bill.serviceRate * 100),
    tableCharge: bill.tableCharge,
    discount,
    displayTotal,
    showServiceLine: bill.serviceFee > 0.01,
  };
}
