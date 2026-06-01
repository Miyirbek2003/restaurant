import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type RestaurantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';

export type RestaurantWithManager = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: RestaurantStatus;
  subscription_plan: string;
  currency: string;
  manager: {
    id: string;
    email: string | null;
    name: string;
    status: string;
  } | null;
};

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const { data: restaurants, error: rErr } = await supabase
        .from('restaurants')
        .select('*')
        .order('name');
      if (rErr) throw rErr;

      const { data: managers, error: mErr } = await supabase
        .from('profiles')
        .select('id, email, name, restaurant_id, status')
        .eq('role', 'MANAGER');
      if (mErr) throw mErr;

      const managerByRestaurant = new Map(
        (managers ?? []).map((m) => [m.restaurant_id, m]),
      );

      return (restaurants ?? []).map((r) => ({
        ...r,
        manager: managerByRestaurant.get(r.id) ?? null,
      })) as RestaurantWithManager[];
    },
  });
}

export function useCreateRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      slug: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      subscription_plan?: string;
      status?: RestaurantStatus;
      currency?: string;
    }) => {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({
          name: body.name,
          slug: body.slug,
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          subscription_plan: body.subscription_plan ?? 'FREE',
          status: body.status ?? 'TRIAL',
          currency: body.currency ?? 'USD',
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurants'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export type RestaurantUpdateBody = {
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  subscription_plan?: string;
  status?: RestaurantStatus;
  currency?: string;
};

export function useUpdateRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: RestaurantUpdateBody & { id: string }) => {
      const { data, error } = await supabase
        .from('restaurants')
        .update({
          name: body.name,
          slug: body.slug,
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          subscription_plan: body.subscription_plan,
          status: body.status,
          currency: body.currency,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurants'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
