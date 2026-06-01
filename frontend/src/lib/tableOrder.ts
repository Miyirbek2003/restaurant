import { supabase } from '@/lib/supabase';
import type { TableStatus } from '@/types';

/** Active orders that keep a table unavailable for a new order. */
export const OPEN_ORDER_STATUSES = ['DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED'] as const;

export function isTableAvailableForNewOrder(table: { status: TableStatus | string }): boolean {
  return table.status === 'FREE';
}

export async function assertTableAvailableForNewOrder(tableId: string): Promise<void> {
  const { data: table, error: tErr } = await supabase
    .from('tables')
    .select('status')
    .eq('id', tableId)
    .single();
  if (tErr) throw tErr;

  if (table.status === 'OCCUPIED') {
    throw new Error('TABLE_OCCUPIED');
  }

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
