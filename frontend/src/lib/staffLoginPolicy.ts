import { isCashier, isWaiter } from '@/lib/roles';
import { isPinWaiterSession, isWaiterTerminal } from '@/lib/waiterTerminal';
import type { UserRole } from '@/types';
import { t } from '@/i18n';

export type StaffLoginBlockReason = 'waiter_pin_only' | 'cashier_terminal_only' | 'terminal_manager_only';

export function staffLoginBlockReason(role: UserRole | undefined): StaffLoginBlockReason | null {
  if (!role) return null;
  if (isWaiter(role)) return 'waiter_pin_only';
  if (isCashier(role) && !isWaiterTerminal()) return 'cashier_terminal_only';
  return null;
}

export function staffLoginBlockMessage(reason: StaffLoginBlockReason): string {
  switch (reason) {
    case 'waiter_pin_only':
      return t('auth.waiterPinOnly');
    case 'cashier_terminal_only':
      return t('auth.cashierTerminalOnly');
    case 'terminal_manager_only':
      return t('terminal.staffEmailOnly');
  }
}

/** Active session policy: waiters must use PIN; cashiers only on bound terminals. */
export function activeSessionBlockReason(role: UserRole | undefined): StaffLoginBlockReason | null {
  if (!role) return null;
  if (isWaiter(role) && !isPinWaiterSession()) return 'waiter_pin_only';
  if (isCashier(role) && !isWaiterTerminal()) return 'cashier_terminal_only';
  return null;
}
