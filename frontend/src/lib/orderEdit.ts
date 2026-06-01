import type { OrderStatus } from '@/types';

/** Statuses where line items (qty add/remove) may still be changed. */
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED'];

export function canEditOrderItems(status: OrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

/** Order is ready for guest payment (served or marked ready at table). */
export function canPayOrder(status: OrderStatus): boolean {
  return status === 'READY' || status === 'SERVED';
}

/** Stock was reserved for this order (warehouse + menu product stock). */
export function orderStockWasDeducted(order: {
  stock_deducted?: boolean;
  status?: OrderStatus;
  sent_to_kitchen_at?: string | null;
}): boolean {
  return Boolean(order.stock_deducted);
}

/** Menu products with tracked quantity (POS countable items). */
export function isCountableProduct(product: { stock_quantity: number; is_active?: boolean }): boolean {
  return product.is_active !== false;
}
