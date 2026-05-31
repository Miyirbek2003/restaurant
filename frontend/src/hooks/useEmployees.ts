import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type StaffRole = 'WAITER' | 'KITCHEN';
export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface RestaurantStaff {
  id: string;
  restaurant_id: string;
  name: string;
  role: StaffRole;
  phone: string | null;
  email: string | null;
  status: StaffStatus;
  hire_date: string | null;
  created_at: string;
}

export function useEmployees(role?: StaffRole) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['restaurant-staff', restaurantId, role],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      let q = supabase
        .from('restaurant_staff')
        .select('id, restaurant_id, name, role, phone, email, status, hire_date, created_at')
        .eq('restaurant_id', restaurantId!)
        .order('name');

      if (role) q = q.eq('role', role);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RestaurantStaff[];
    },
  });
}

export function useWaiters() {
  return useEmployees('WAITER');
}

export function useCreateStaffMember() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      name: string;
      role: StaffRole;
      phone?: string;
      email?: string;
    }) => {
      if (!restaurantId) throw new Error('No restaurant assigned');
      const { data, error } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          name: body.name.trim(),
          role: body.role,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          status: 'ACTIVE',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-staff'] }),
  });
}

export function useUpdateStaffStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, status }: { staffId: string; status: StaffStatus }) => {
      const { error } = await supabase.from('restaurant_staff').update({ status }).eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-staff'] }),
  });
}

export function useDeleteStaffMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from('restaurant_staff').delete().eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-staff'] }),
  });
}
