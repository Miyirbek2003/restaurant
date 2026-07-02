import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { createStaffWithAuth } from '@/lib/staffProvisioning';

export type StaffRole = 'WAITER' | 'KITCHEN' | 'CASHIER';
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
  auth_user_id: string | null;
  pin_set_at: string | null;
}

export function useEmployees(role?: StaffRole) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['restaurant-staff', restaurantId, role],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      let q = supabase
        .from('restaurant_staff')
        .select(
          'id, restaurant_id, name, role, phone, email, status, hire_date, created_at, auth_user_id, pin_set_at',
        )
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
      phone: string;
      email?: string;
    }) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const name = body.name.trim();
      const phone = body.phone.trim();
      if (!name || !phone) throw new Error('Name and phone are required');

      if (body.role === 'WAITER' || body.role === 'CASHIER') {
        const email = body.email?.trim();
        if (!email) throw new Error('Email is required for waiters and cashiers');
        return createStaffWithAuth({ name, phone, email, role: body.role });
      }

      const { data, error } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          name,
          role: body.role,
          phone,
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

export function useSetStaffPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, pin }: { staffId: string; pin: string }) => {
      const { error } = await supabase.rpc('set_staff_pin', { p_staff_id: staffId, p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-staff'] }),
  });
}

export function useClearStaffPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.rpc('clear_staff_pin', { p_staff_id: staffId });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['restaurant-staff'] }),
  });
}
