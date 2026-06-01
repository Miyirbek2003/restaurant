import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format money: space thousands, dot decimals, no currency symbol (e.g. 1 234 567.89). */
export function formatCurrency(amount: number, _currency?: string) {
  return formatAmount(amount, 2);
}

/** Format a number with space thousands and dot decimal separator. */
export function formatAmount(amount: number, decimals = 2): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';
  }

  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, fracPart = ''] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (decimals <= 0) return `${sign}${grouped}`;
  return `${sign}${grouped}.${fracPart}`;
}
