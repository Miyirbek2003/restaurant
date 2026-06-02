import { useMutation } from '@tanstack/react-query';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
export function useLogin() {
  const { signIn, refreshProfile } = useAuthContext();
  const addNotification = useNotificationStore((s) => s.add);

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      await signIn(credentials.email, credentials.password);
      const { completePendingWaiterInviteIfNeeded, completePendingCashierInviteIfNeeded } = await import('@/lib/staffInvite');
      const waiterDone = await completePendingWaiterInviteIfNeeded();
      const cashierDone = await completePendingCashierInviteIfNeeded();
      if (waiterDone || cashierDone) await refreshProfile();
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
