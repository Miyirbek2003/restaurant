import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyStaffId } from '@/lib/staffInvite';
import { isWaiter } from '@/lib/roles';

export function useMyStaffId() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['my-staff-id', profile?.id],
    enabled: Boolean(profile?.id && profile.role && isWaiter(profile.role)),
    queryFn: fetchMyStaffId,
  });
}
