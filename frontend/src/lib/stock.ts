import { supabase } from '@/lib/supabase';

export type CartStockLine = { product_id: string; quantity: number };

export type StockFailure = {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
};

export async function validateOrderStock(items: CartStockLine[]): Promise<StockFailure[]> {
  const { data, error } = await supabase.rpc('validate_order_stock', {
    p_items: items,
  });
  if (error) throw error;
  const result = data as { ok?: boolean; failures?: StockFailure[] };
  if (result?.ok) return [];
  return result?.failures ?? [];
}

export async function deductOrderStock(items: CartStockLine[]): Promise<void> {
  const { error } = await supabase.rpc('deduct_order_stock', { p_items: items });
  if (error) throw error;
}

export async function reportStockShortage(
  productId: string,
  requestedQty: number,
  availableQty: number,
): Promise<void> {
  const { error } = await supabase.rpc('report_stock_shortage', {
    p_product_id: productId,
    p_requested_qty: requestedQty,
    p_available_qty: availableQty,
  });
  if (error) throw error;
}

export async function updateTableStatus(tableId: string, status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING') {
  const { error } = await supabase.rpc('update_table_status', {
    p_table_id: tableId,
    p_status: status,
  });
  if (error) throw error;
}

export function cartQtyForProduct(cart: CartStockLine[], productId: string): number {
  return cart.find((c) => c.product_id === productId)?.quantity ?? 0;
}
