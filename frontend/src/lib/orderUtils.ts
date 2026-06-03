/** Date used for period filters: payment day when paid, otherwise order created day. */
export function orderDateForFilter(order: {
  status: string;
  paid_at?: string | null;
  created_at: string;
}): string {
  if (order.status === 'PAID' && order.paid_at) return order.paid_at;
  return order.created_at;
}

/** Resolve table display name from order join (tables). */
export function getTableName(
  order: {
    tables?: { name: string } | { name: string }[] | null;
    table_id?: string | null;
  },
  takeawayLabel: string,
): string {
  const raw = order.tables;
  if (raw) {
    if (Array.isArray(raw)) return raw[0]?.name ?? (order.table_id ? '—' : takeawayLabel);
    return raw.name ?? (order.table_id ? '—' : takeawayLabel);
  }
  return order.table_id ? '—' : takeawayLabel;
}

/** Resolve waiter display name from order join (restaurant_staff). */
export function getWaiterName(order: {
  staff?: { name: string; role?: string } | { name: string; role?: string }[] | null;
  /** @deprecated legacy profile join */
  waiter?: { name: string } | { name: string }[] | null;
  profiles?: { name: string } | { name: string }[] | null;
}): string {
  const raw = order.staff ?? order.waiter ?? order.profiles;
  if (!raw) return '—';
  if (Array.isArray(raw)) return raw[0]?.name ?? '—';
  return raw.name ?? '—';
}
