import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export function useQrMenuSettings() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['qr-menu-settings', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('qr_menu_enabled')
        .eq('restaurant_id', restaurantId!)
        .maybeSingle();

      if (error) throw error;
      return { enabled: data?.qr_menu_enabled ?? true };
    },
  });
}

export function useUpdateQrMenuEnabled() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const { data: existing, error: readErr } = await supabase
        .from('restaurant_settings')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (readErr) throw readErr;

      if (existing?.id) {
        const { error } = await supabase
          .from('restaurant_settings')
          .update({ qr_menu_enabled: enabled })
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('restaurant_settings').insert({
          restaurant_id: restaurantId,
          qr_menu_enabled: enabled,
        });
        if (error) throw error;
      }

      return { enabled };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qr-menu-settings'] });
    },
  });
}
