import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type ExpenseRow = {
  id: string;
  restaurant_id: string;
  category: string;
  title: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  notes: string | null;
  staff_id: string | null;
  cash_register_session_id: string | null;
  created_at: string;
  staff: { id: string; name: string } | null;
};

export function useExpensesList() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['expenses', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, staff:staff_id(id, name)')
        .eq('restaurant_id', restaurantId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const staff = row.staff;
        return {
          ...row,
          staff: Array.isArray(staff) ? staff[0] ?? null : staff,
        };
      }) as ExpenseRow[];
    },
  });
}
