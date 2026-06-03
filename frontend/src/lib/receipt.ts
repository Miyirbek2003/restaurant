import type { OrderBill } from '@/lib/orderBilling';
import { buildOrderBill } from '@/lib/orderBilling';
import { printOrderReceipt, type OrderReceiptData } from '@/lib/printOrderReceipt';
import type { PaymentLine } from '@/lib/payments';
import { getWaiterName } from '@/lib/orderUtils';
import { orderItemName, type OrderItemNameSource } from '@/lib/orderItem';

type RestaurantInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

type OrderForReceipt = {
  order_number: number;
  subtotal: number;
  tax_amount?: number;
  order_items?: Array<
    OrderItemNameSource & {
      id: string;
      quantity: number;
      unit_price: number;
      products?: { name: string } | null;
    }
  >;
  tables?: { name: string } | null;
  staff?: { name: string } | null;
  waiter?: { name: string } | null;
  profiles?: { name: string } | null;
};

export function printReceiptForOrder(
  order: OrderForReceipt,
  tableName: string,
  restaurant: RestaurantInfo,
  payments: PaymentLine[],
  paidAt = new Date(),
  billOverride?: OrderBill,
): void {
  const items = order.order_items ?? [];
  const bill: OrderBill = billOverride ?? buildOrderBill(items, Number(order.subtotal), 0);

  const data: OrderReceiptData = {
    restaurantName: restaurant.name,
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    orderNumber: order.order_number,
    tableName,
    waiterName: getWaiterName(order),
    paidAt,
    bill,
    payments,
  };

  printOrderReceipt(data);
}

export function printCheckForOrder(
  order: OrderForReceipt,
  tableName: string,
  restaurant: RestaurantInfo,
  billOverride?: OrderBill,
): void {
  printReceiptForOrder(order, tableName, restaurant, [], new Date(), billOverride);
}

function restaurantFromProfile(
  restaurants: { name: string; address?: string | null; phone?: string | null; email?: string | null } | null | undefined,
): RestaurantInfo {
  return {
    name: restaurants?.name ?? 'RestoPOS',
    address: restaurants?.address,
    phone: restaurants?.phone,
    email: restaurants?.email,
  };
}

export { restaurantFromProfile };

export function billFromOrderItems(
  items: Array<OrderItemNameSource & { id: string; quantity: number; unit_price: number }>,
  subtotal: number,
): OrderBill {
  return buildOrderBill(items, subtotal, 0);
}

export { orderItemName };
