/** Value for `<input type="datetime-local" />` in local timezone. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse `datetime-local` value as local wall time (not UTC). */
export function parseDatetimeLocal(value: string): Date | null {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  const date = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO timestamptz from DB → `datetime-local` value in local timezone. */
export function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return defaultBookingDatetimeLocal();
  return toDatetimeLocalValue(date);
}

/** `datetime-local` value → ISO string for Supabase timestamptz. */
export function datetimeLocalToIso(value: string): string {
  const date = parseDatetimeLocal(value);
  if (!date) throw new Error('Invalid datetime-local');
  return date.toISOString();
}

/** Earliest selectable local datetime (now). */
export function minFutureDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date());
}

export function isDatetimeLocalInPast(value: string): boolean {
  const d = parseDatetimeLocal(value);
  if (!d) return true;
  return d.getTime() < Date.now();
}

/** Default booking slot: next full hour from now. */
export function defaultBookingDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getTime() < Date.now()) {
    d.setHours(d.getHours() + 1);
  }
  return toDatetimeLocalValue(d);
}
