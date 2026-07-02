import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type ResourceTable = 'customers' | 'suppliers' | 'expenses' | 'discounts';

export function useResourceList<T>(table: ResourceTable, select = '*') {
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

export function useResourceInsert(table: ResourceTable) {
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [table] });
      if (table === 'expenses') {
        void qc.invalidateQueries({ queryKey: ['salaries'] });
        void qc.invalidateQueries({ queryKey: ['cash-register-session-expenses'] });
      }
    },
  });
}

export function useResourceUpdate(table: ResourceTable) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from(table).update(body).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [table] });
      if (table === 'expenses') void qc.invalidateQueries({ queryKey: ['salaries'] });
    },
  });
}

export function useResourceDelete(table: ResourceTable) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [table] });
      if (table === 'expenses') void qc.invalidateQueries({ queryKey: ['salaries'] });
    },
  });
}
