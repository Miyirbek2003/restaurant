import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId, useAuth } from '@/contexts/AuthContext';
import type { StaffRole } from '@/hooks/useEmployees';
import { getJoinUrl } from '@/lib/staffInvite';

export { getJoinUrl };

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function useStaffInvites() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['staff-invites', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateStaffInvite() {
  const restaurantId = useRestaurantId();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { role: StaffRole; label?: string; daysValid?: number }) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const expires = new Date();
      expires.setDate(expires.getDate() + (input.daysValid ?? 7));

      const { data, error } = await supabase
        .from('staff_invites')
        .insert({
          restaurant_id: restaurantId,
          code: generateCode(),
          role: input.role,
          label: input.label ?? null,
          created_by: user?.id ?? null,
          expires_at: expires.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-invites'] }),
  });
}

export function useRevokeStaffInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_invites').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-invites'] }),
  });
}

export function usePreviewInvite(code: string) {
  return useQuery({
    queryKey: ['invite-preview', code],
    enabled: code.length >= 4,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_staff_invite', { p_code: code.trim() });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Invalid or expired invite code');
      return row as { restaurant_name: string; role: string; expires_at: string };
    },
    retry: false,
  });
}

