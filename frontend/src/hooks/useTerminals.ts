import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export interface RestaurantTerminal {
  id: string;
  label: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export function useTerminals() {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ['restaurant-terminals', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_restaurant_terminals');
      if (error) throw error;
      return (data ?? []) as RestaurantTerminal[];
    },
  });
}

export function useRegisterTerminal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase.rpc('register_terminal', { p_label: label });
      if (error) throw error;
      return data as { terminal_id: string; token: string };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-terminals'] }),
  });
}

export function useRevokeTerminal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('revoke_terminal', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-terminals'] }),
  });
}
