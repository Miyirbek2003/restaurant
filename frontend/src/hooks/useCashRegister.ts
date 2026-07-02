import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth, useRestaurantId } from '@/contexts/AuthContext';
import { matchesDateRange } from '@/lib/filters';
import { OPEN_ORDER_STATUSES } from '@/lib/tableOrder';
import { PAYMENT_METHOD_LABEL_KEYS, type PaymentMethod } from '@/lib/payments';
import { fetchMyStaffId } from '@/lib/staffInvite';
import type { IncomeRow } from '@/hooks/useIncomes';
import { t } from '@/i18n';

export type CashRegisterSession = {
  id: string;
  restaurant_id: string;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  opened_by_profile_id: string | null;
  opened_by_staff_id: string | null;
  opening_float: number;
  opening_notes: string | null;
  closed_at: string | null;
  closed_by_profile_id: string | null;
  expected_cash: number;
  expected_card: number;
  expected_click: number;
  counted_cash: number | null;
  counted_card: number | null;
  counted_click: number | null;
  closing_notes: string | null;
  orders_paid_count: number;
  kassa_expenses_total?: number;
  created_at: string;
  opened_by_staff?: { name: string } | null;
  opened_by_profile?: { name: string } | null;
};

export type PaymentMethodTotals = {
  total: number;
  cash: number;
  card: number;
  click: number;
  mobile: number;
  other: number;
  count: number;
};

export function summarizePayments(
  payments: IncomeRow[],
  dateFrom: string,
  dateTo: string,
): PaymentMethodTotals {
  const result: PaymentMethodTotals = {
    total: 0,
    cash: 0,
    card: 0,
    click: 0,
    mobile: 0,
    other: 0,
    count: 0,
  };

  for (const p of payments) {
    if (!matchesDateRange(p.created_at, dateFrom, dateTo)) continue;
    const amount = Number(p.amount);
    result.total += amount;
    result.count += 1;
    switch (p.method) {
      case 'CASH':
        result.cash += amount;
        break;
      case 'CARD':
        result.card += amount;
        break;
      case 'CLICK':
        result.click += amount;
        break;
      case 'MOBILE':
        result.mobile += amount;
        break;
      default:
        result.other += amount;
        break;
    }
  }

  return result;
}

function mapMethodTotals(rows: { method: string; amount: number }[]): Omit<PaymentMethodTotals, 'count' | 'total'> & { total: number } {
  const t = { cash: 0, card: 0, click: 0, mobile: 0, other: 0, total: 0 };
  for (const r of rows) {
    const amount = Number(r.amount);
    t.total += amount;
    switch (r.method) {
      case 'CASH':
        t.cash += amount;
        break;
      case 'CARD':
        t.card += amount;
        break;
      case 'CLICK':
        t.click += amount;
        break;
      case 'MOBILE':
        t.mobile += amount;
        break;
      default:
        t.other += amount;
        break;
    }
  }
  return t;
}

export function useOpenCashRegisterSession() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cash-register-open', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'OPEN')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let opened_by_staff: { name: string } | null = null;
      if (data.opened_by_staff_id) {
        const { data: staff } = await supabase
          .from('restaurant_staff')
          .select('name')
          .eq('id', data.opened_by_staff_id)
          .maybeSingle();
        opened_by_staff = staff;
      }
      return { ...data, opened_by_staff } as CashRegisterSession;
    },
  });
}

export function useCashRegisterSessions(limit = 30) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cash-register-sessions', restaurantId, limit],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const staffIds = [...new Set((data ?? []).map((r) => r.opened_by_staff_id).filter(Boolean))] as string[];
      let staffNames: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: staffRows } = await supabase.from('restaurant_staff').select('id, name').in('id', staffIds);
        staffNames = Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.name]));
      }
      return (data ?? []).map((row) => ({
        ...row,
        opened_by_staff: row.opened_by_staff_id
          ? { name: staffNames[row.opened_by_staff_id] ?? '—' }
          : null,
      })) as CashRegisterSession[];
    },
  });
}

export function useSessionPaymentTotals(sessionId: string | undefined, openedAt: string | undefined) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cash-register-session-totals', sessionId],
    enabled: !!restaurantId && !!sessionId && !!openedAt,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('method, amount')
        .eq('restaurant_id', restaurantId!)
        .eq('cash_register_session_id', sessionId!)
        .eq('status', 'COMPLETED');
      if (error) throw error;
      const mapped = mapMethodTotals((data ?? []) as { method: string; amount: number }[]);
      return { ...mapped, count: data?.length ?? 0 } as PaymentMethodTotals;
    },
  });
}

export type SessionSoldItem = {
  productId: string | null;
  name: string;
  quantitySold: number;
};

export function useSessionSoldItems(sessionId: string | undefined, enabled: boolean) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cash-register-session-items', sessionId],
    enabled: !!restaurantId && !!sessionId && enabled,
    queryFn: async () => {
      const { data: pays, error: payErr } = await supabase
        .from('payments')
        .select('order_id')
        .eq('restaurant_id', restaurantId!)
        .eq('cash_register_session_id', sessionId!)
        .eq('status', 'COMPLETED');
      if (payErr) throw payErr;

      const orderIds = [...new Set((pays ?? []).map((p) => p.order_id).filter(Boolean))] as string[];
      if (orderIds.length === 0) return [] as SessionSoldItem[];

      const { data: items, error: itemErr } = await supabase
        .from('order_items')
        .select('product_id, product_name, quantity')
        .eq('restaurant_id', restaurantId!)
        .in('order_id', orderIds);
      if (itemErr) throw itemErr;

      const map = new Map<string, SessionSoldItem>();
      for (const it of items ?? []) {
        const key = it.product_id ?? `name:${it.product_name}`;
        const qty = Number(it.quantity) || 0;
        const existing = map.get(key);
        if (existing) {
          existing.quantitySold += qty;
        } else {
          map.set(key, {
            productId: it.product_id ?? null,
            name: it.product_name ?? '—',
            quantitySold: qty,
          });
        }
      }

      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export type KassaExpenseRow = {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  notes: string | null;
};

export function useSessionKassaExpenses(sessionId: string | undefined, enabled = true) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cash-register-session-expenses', sessionId],
    enabled: !!restaurantId && !!sessionId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, title, amount, date, category, notes')
        .eq('restaurant_id', restaurantId!)
        .eq('cash_register_session_id', sessionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KassaExpenseRow[];
    },
  });
}

export function useOpenOrdersCount() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['open-orders-count', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!)
        .in('status', [...OPEN_ORDER_STATUSES]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useCashiers() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['cashiers', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_staff')
        .select('id, name, role, status')
        .eq('restaurant_id', restaurantId!)
        .eq('role', 'CASHIER')
        .eq('status', 'ACTIVE')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOpenCashRegister() {
  const restaurantId = useRestaurantId();
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      openedByStaffId: string;
      openingFloat: number;
      openingNotes?: string;
    }) => {
      const { data: existing } = await supabase
        .from('cash_register_sessions')
        .select('id')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'OPEN')
        .maybeSingle();
      if (existing) throw new Error('CASH_REGISTER_ALREADY_OPEN');

      const { data, error } = await supabase
        .from('cash_register_sessions')
        .insert({
          restaurant_id: restaurantId!,
          status: 'OPEN',
          opened_by_profile_id: profile?.id ?? null,
          opened_by_staff_id: body.openedByStaffId,
          opening_float: body.openingFloat,
          opening_notes: body.openingNotes || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cash-register-open'] });
      void qc.invalidateQueries({ queryKey: ['cash-register-sessions'] });
    },
  });
}

export function useCloseCashRegister() {
  const restaurantId = useRestaurantId();
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      sessionId: string;
      expected: PaymentMethodTotals;
      countedCash: number;
      countedCard: number;
      countedClick: number;
      closingNotes?: string;
      kassaExpensesTotal?: number;
    }) => {
      const { data: session, error: sessionErr } = await supabase
        .from('cash_register_sessions')
        .select('id, opened_by_profile_id, opened_by_staff_id, status')
        .eq('id', body.sessionId)
        .eq('restaurant_id', restaurantId!)
        .maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!session || session.status !== 'OPEN') throw new Error('CASH_REGISTER_NOT_OPEN');

      let myStaffId: string | null = null;
      if (session.opened_by_staff_id) {
        myStaffId = await fetchMyStaffId();
      }
      const isOwner =
        (session.opened_by_profile_id && session.opened_by_profile_id === profile?.id) ||
        (session.opened_by_staff_id && myStaffId && session.opened_by_staff_id === myStaffId);
      if (!isOwner) throw new Error('CASH_REGISTER_OPENED_BY_ANOTHER_CASHIER');

      const { data, error } = await supabase
        .from('cash_register_sessions')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          closed_by_profile_id: profile?.id ?? null,
          expected_cash: body.expected.cash,
          expected_card: body.expected.card + body.expected.mobile,
          expected_click: body.expected.click,
          counted_cash: body.countedCash,
          counted_card: body.countedCard,
          counted_click: body.countedClick,
          closing_notes: body.closingNotes || null,
          orders_paid_count: body.expected.count,
          kassa_expenses_total: body.kassaExpensesTotal ?? 0,
        })
        .eq('id', body.sessionId)
        .eq('restaurant_id', restaurantId!)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cash-register-open'] });
      void qc.invalidateQueries({ queryKey: ['cash-register-sessions'] });
    },
  });
}

export function paymentMethodLabel(method: PaymentMethod | string): string {
  const key = PAYMENT_METHOD_LABEL_KEYS[method as PaymentMethod];
  if (key) return t(key);
  return method;
}
