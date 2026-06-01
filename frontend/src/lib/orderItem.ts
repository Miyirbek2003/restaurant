export type OrderItemNameSource = {
  product_name?: string | null;
  products?: { name: string } | null;
};

export function orderItemName(item: OrderItemNameSource, fallback = 'Unknown'): string {
  const snap = item.product_name?.trim();
  if (snap) return snap;
  return item.products?.name?.trim() || fallback;
}
