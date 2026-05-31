import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type RestaurantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      slug: string;
      email?: string;
      phone?: string;
      subscription_plan?: string;
      status?: RestaurantStatus;
    }) => {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({
          name: body.name,
          slug: body.slug,
          email: body.email ?? null,
          phone: body.phone ?? null,
          subscription_plan: body.subscription_plan ?? 'FREE',
          status: body.status ?? 'TRIAL',
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('restaurant_settings').insert({ restaurant_id: restaurant.id });
      return restaurant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurants'] }),
  });
}

export function useUpdateRestaurantStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RestaurantStatus }) => {
      const { data, error } = await supabase
        .from('restaurants')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurants'] }),
  });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
