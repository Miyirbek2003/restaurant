import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type MyRestaurant = {
  id: string;
  name: string;
  logo_url: string | null;
};

export function useMyRestaurant() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['my-restaurant', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async (): Promise<MyRestaurant> => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('id', restaurantId!)
        .single();

      if (error) throw error;
      return data as MyRestaurant;
    },
  });
}

export function useUpdateRestaurantLogo() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (logo_url: string | null) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const { error } = await supabase
        .from('restaurants')
        .update({ logo_url: logo_url || null })
        .eq('id', restaurantId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-restaurant'] });
      void qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
