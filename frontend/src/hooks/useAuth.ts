import { useMutation } from '@tanstack/react-query';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { isManager } from '@/lib/roles';
import type { UserRole } from '@/types';
import { t } from '@/i18n';

export function useLogin() {
  const { signIn, signOut, refreshProfile } = useAuthContext();
  const addNotification = useNotificationStore((s) => s.add);

  return useMutation({
    mutationFn: async (credentials: {
      email: string;
      password: string;
      /** On a bound terminal, only managers may use email/password (not waiters). */
      managerOnly?: boolean;
    }) => {
      await signIn(credentials.email, credentials.password);
      const { completePendingWaiterInviteIfNeeded, completePendingCashierInviteIfNeeded } =
        await import('@/lib/staffInvite');
      const waiterDone = await completePendingWaiterInviteIfNeeded();
      const cashierDone = await completePendingCashierInviteIfNeeded();
      if (waiterDone || cashierDone) await refreshProfile();

      if (credentials.managerOnly) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error(t('terminal.managerOnly'));

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (error) throw error;

        const role = profile?.role as UserRole | undefined;
        if (!role || !isManager(role)) {
          await signOut();
          throw new Error(t('terminal.managerOnly'));
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
