import type { OrderBill } from '@/lib/orderBilling';
import { buildOrderBill } from '@/lib/orderBilling';
import { printOrderReceipt, type OrderReceiptData } from '@/lib/printOrderReceipt';
import type { PaymentLine } from '@/lib/payments';
import { getWaiterName } from '@/lib/orderUtils';
import { orderItemName, type OrderItemNameSource } from '@/lib/orderItem';
import { sortOrderItemsByCreated } from '@/lib/orderItemSave';

type RestaurantInfo = {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

type OrderForReceipt = {
  order_number: number;
  subtotal: number;
  order_items?: Array<
    OrderItemNameSource & {
      id: string;
      quantity: number;
      unit_price: number;
      created_at?: string | null;
      products?: { name: string; sale_unit?: string | null } | null;
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
  serviceRate = 0,
): void {
  const items = sortOrderItemsByCreated(order.order_items ?? []);
  const bill: OrderBill = billOverride ?? buildOrderBill(items, Number(order.subtotal), serviceRate, 0);

  const data: OrderReceiptData = {
    restaurantName: restaurant.name,
    logoUrl: restaurant.logo_url,
    address: restaurant.address,
    phone: restaurant.phone,
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
  serviceRate = 0,
): void {
  printReceiptForOrder(order, tableName, restaurant, [], new Date(), billOverride, serviceRate);
}

function restaurantFromProfile(
  restaurants:
    | { name: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null }
    | null
    | undefined,
): RestaurantInfo {
  return {
    name: restaurants?.name ?? 'RestoPOS',
    logo_url: restaurants?.logo_url,
    address: restaurants?.address,
    phone: restaurants?.phone,
    email: restaurants?.email,
  };
}

export { restaurantFromProfile };

export function billFromOrderItems(
  items: Array<OrderItemNameSource & { id: string; quantity: number; unit_price: number }>,
  subtotal: number,
  serviceRate = 0,
): OrderBill {
  return buildOrderBill(items, subtotal, serviceRate, 0);
}

export { orderItemName };
