import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
function parseFloors(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
  }
  return [];
}

export function useRestaurantFloors() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['restaurant-floors', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('floors')
        .eq('restaurant_id', restaurantId!)
        .maybeSingle();

      if (error) {
        if (error.code === '42703' || error.message.includes('floors')) {
          return [];
        }
        throw error;
      }

      return parseFloors(data?.floors);
    },
  });
}

export function useAddRestaurantFloor() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Floor name is required');
      if (!restaurantId) throw new Error('No restaurant assigned');

      const { data: existing, error: readErr } = await supabase
        .from('restaurant_settings')
        .select('id, floors')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (readErr && readErr.code !== 'PGRST116') {
        if (readErr.code === '42703' || readErr.message.includes('floors')) {
          throw new Error('Run migration 20250531000009_restaurant_floors.sql in Supabase SQL Editor.');
        }
        throw readErr;
      }

      const current = parseFloors(existing?.floors);
      if (current.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('This floor already exists');
      }

      const next = [...current, trimmed];

      if (existing?.id) {
        const { error } = await supabase
          .from('restaurant_settings')
          .update({ floors: next })
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('restaurant_settings').insert({
          restaurant_id: restaurantId,
          floors: next,
        });
        if (error) throw error;
      }

      return next;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-floors'] }),
  });
}
