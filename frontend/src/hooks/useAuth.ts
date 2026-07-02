import { useMutation } from '@tanstack/react-query';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { isManager } from '@/lib/roles';
import { staffLoginBlockMessage, staffLoginBlockReason } from '@/lib/staffLoginPolicy';
import type { UserRole } from '@/types';
import { t } from '@/i18n';

async function fetchLoginRole(userId: string): Promise<UserRole | undefined> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return profile?.role as UserRole | undefined;
}

export function useLogin() {
  const { signIn, signOut } = useAuthContext();
  const addNotification = useNotificationStore((s) => s.add);

  return useMutation({
    mutationFn: async (credentials: {
      email: string;
      password: string;
      /** Password login opened from a bound in-restaurant terminal. */
      terminalEmailLogin?: boolean;
    }) => {
      await signIn(credentials.email, credentials.password);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error(t('auth.signIn'));

      const role = await fetchLoginRole(user.id);

      const staffBlock = staffLoginBlockReason(role);
      if (staffBlock) {
        await signOut();
        throw new Error(staffLoginBlockMessage(staffBlock));
      }

      if (credentials.terminalEmailLogin) {
        if (!role || (!isManager(role) && role !== 'SUPER_ADMIN')) {
          await signOut();
          throw new Error(staffLoginBlockMessage('terminal_manager_only'));
        }
      }
    },
    onSuccess: () => {
      addNotification({ type: 'success', title: 'Welcome back!' });
    },
    onError: (err) => {
      addNotification({ type: 'error', title: 'Login failed', message: getErrorMessage(err) });
    },
  });
}

export { useAuth, useRestaurantId } from '@/contexts/AuthContext';
