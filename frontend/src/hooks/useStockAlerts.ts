import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type StockAlert = {
  id: string;
  product_name: string;
  requested_qty: number;
  available_qty: number;
  staff_name: string | null;
  created_at: string;
  acknowledged_at: string | null;
};

export function useStockAlerts() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['stock-alerts', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_shortage_alerts')
        .select('id, product_name, requested_qty, available_qty, staff_name, created_at, acknowledged_at')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as StockAlert[];
    },
  });
}

export function useAcknowledgeStockAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_shortage_alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stock-alerts'] }),
  });
}
