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
