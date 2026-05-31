import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

type TableName =
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'discounts'
  | 'inventory_items';

export function useResourceList<T>(table: TableName, select = '*') {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: [table, restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as T[];
    },
  });
}

export function useResourceInsert(table: TableName) {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from(table)
        .insert({ ...body, restaurant_id: restaurantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}
