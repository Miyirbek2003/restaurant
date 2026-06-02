import { supabase } from '@/lib/supabase';

/** Active orders that keep a table unavailable for a new order. */
export const OPEN_ORDER_STATUSES = ['DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED'] as const;

export function isTableAvailableForNewOrder(
  table: { id?: string },
  openOrderTableIds?: ReadonlySet<string>,
): boolean {
  // Source of truth is whether there is already an open order on table.
  // Table status can be stale in UI until sync.
  if (table.id && openOrderTableIds?.has(table.id)) return false;
  return true;
}

export async function assertTableAvailableForNewOrder(tableId: string): Promise<void> {
  const { data: openOrder, error: oErr } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', tableId)
    .in('status', [...OPEN_ORDER_STATUSES])
    .limit(1)
    .maybeSingle();
  if (oErr) throw oErr;
  if (openOrder) throw new Error('TABLE_OCCUPIED');
}
