import type { OrderStatus } from '@/types';

export const ORDER_DISCARD_WINDOW_MS = 2 * 60 * 1000;

export function canDiscardOrder(order: { status: OrderStatus; created_at: string }): boolean {
  if (order.status === 'PAID' || order.status === 'CANCELLED') return false;
  return Date.now() - new Date(order.created_at).getTime() <= ORDER_DISCARD_WINDOW_MS;
}

export function discardSecondsRemaining(created_at: string): number {
  const msLeft = ORDER_DISCARD_WINDOW_MS - (Date.now() - new Date(created_at).getTime());
  return Math.max(0, Math.ceil(msLeft / 1000));
}
