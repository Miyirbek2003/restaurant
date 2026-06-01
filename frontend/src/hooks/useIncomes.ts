import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type IncomeRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  created_at: string;
  orders: {
    id: string;
    order_number: number;
    status: string;
    total: number;
    tables: { name: string } | null;
    staff: { name: string } | null;
  } | null;
};

const incomeSelect = `
  id,
  amount,
  method,
  status,
  reference,
  created_at,
  orders(
    id,
    order_number,
    status,
    total,
    tables(name),
    staff:restaurant_staff(name)
  )
`;

export function useIncomes() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['incomes', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(incomeSelect)
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const raw = Array.isArray(row.orders) ? row.orders[0] : row.orders;
        if (!raw) return { ...row, orders: null } as IncomeRow;
        const tables = Array.isArray(raw.tables) ? raw.tables[0] : raw.tables;
        const staff = Array.isArray(raw.staff) ? raw.staff[0] : raw.staff;
        return {
          ...row,
          orders: {
            ...raw,
            tables: tables ?? null,
            staff: staff ?? null,
          },
        } as IncomeRow;
      });
    },
  });
}
