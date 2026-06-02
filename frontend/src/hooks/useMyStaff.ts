import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyStaffId } from '@/lib/staffInvite';

export function useMyStaffId() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['my-staff-id', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: fetchMyStaffId,
  });
}
