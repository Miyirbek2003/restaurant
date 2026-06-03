import { eachMonthOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { matchesDateRange } from '@/lib/filters';
import type { ExpenseRow } from '@/hooks/useExpenses';

export type StaffSalaryRow = {
  id: string;
  name: string;
  total: number;
  paymentCount: number;
  payments: ExpenseRow[];
};

export type SalaryMonthGroup = {
  key: string;
  title: string;
  monthTotal: number;
  staffRows: StaffSalaryRow[];
};

/** Every calendar month from dateFrom through dateTo (inclusive). */
export function monthsInRange(dateFrom: string, dateTo: string): Date[] {
  const anchor = dateFrom || dateTo || format(new Date(), 'yyyy-MM-dd');
  const start = startOfMonth(parseISO(anchor));
  const end = startOfMonth(parseISO(dateTo || dateFrom || anchor));
  if (start > end) return [start];
  return eachMonthOfInterval({ start, end });
}

export function buildStaffSalaryRows(
  staff: { id: string; name: string }[],
  monthExpenses: ExpenseRow[],
  unassignedLabel: string,
): StaffSalaryRow[] {
  const map = new Map<string, StaffSalaryRow>();

  for (const s of staff) {
    map.set(s.id, { id: s.id, name: s.name, total: 0, paymentCount: 0, payments: [] });
  }

  for (const e of monthExpenses) {
    const key = e.staff_id ?? '_unassigned';
    const name = e.staff?.name ?? unassignedLabel;
    if (!map.has(key)) {
      map.set(key, { id: key, name, total: 0, paymentCount: 0, payments: [] });
    }
    const row = map.get(key)!;
    row.total += Number(e.amount);
    row.paymentCount += 1;
    row.payments.push(e);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      payments: [...row.payments].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.total - a.total);
}

export function groupSalariesByMonth(
  salaryExpenses: ExpenseRow[],
  staff: { id: string; name: string }[],
  dateFrom: string,
  dateTo: string,
  unassignedLabel: string,
): SalaryMonthGroup[] {
  return monthsInRange(dateFrom, dateTo)
    .map((monthDate) => {
      const from = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const to = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      const monthExpenses = salaryExpenses.filter((e) => matchesDateRange(e.date, from, to));

      return {
        key: format(monthDate, 'yyyy-MM'),
        title: format(monthDate, 'LLLL yyyy'),
        monthTotal: monthExpenses.reduce((s, e) => s + Number(e.amount), 0),
        staffRows: buildStaffSalaryRows(staff, monthExpenses, unassignedLabel),
      };
    });
}
