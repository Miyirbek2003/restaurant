/** Case-insensitive match against string fields. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

/** Inclusive date range on YYYY-MM-DD strings (or ISO datetimes). */
export function matchesDateRange(
  value: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const day = value.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function defaultDateRangeDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** First and last day of the current calendar month (local time). */
export function defaultDateRangeMonth(ref = new Date()): { from: string; to: string } {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

export function dateToIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayRange(ref = new Date()): { from: string; to: string } {
  const day = dateToIsoDay(ref);
  return { from: day, to: day };
}

export function yesterdayRange(ref = new Date()): { from: string; to: string } {
  const d = new Date(ref);
  d.setDate(d.getDate() - 1);
  const day = dateToIsoDay(d);
  return { from: day, to: day };
}

export function lastDaysRange(days: number, ref = new Date()): { from: string; to: string } {
  const to = new Date(ref);
  const from = new Date(ref);
  from.setDate(from.getDate() - (days - 1));
  return { from: dateToIsoDay(from), to: dateToIsoDay(to) };
}
