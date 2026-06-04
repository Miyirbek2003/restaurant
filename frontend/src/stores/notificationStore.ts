import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  createdAt: number;
  read: boolean;
  /** Prevents duplicate inbox entries (e.g. booking arrival per id+time). */
  dedupeKey?: string;
}

const MAX_INBOX = 100;
const TOAST_MS = 5000;

export type NotificationInput = Pick<Notification, 'type' | 'title' | 'message'> & {
  /** Persist in header bell inbox (only booking call reminders use this). */
  saveInbox?: boolean;
  dedupeKey?: string;
};

interface NotificationState {
  inbox: Notification[];
  toasts: Notification[];
  add: (n: NotificationInput) => void;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      inbox: [],
      toasts: [],

      add: (n) => {
        const { saveInbox = false, dedupeKey, ...payload } = n;
        if (saveInbox && dedupeKey && get().inbox.some((i) => i.dedupeKey === dedupeKey)) {
          return;
        }

        const id = crypto.randomUUID();
        const item: Notification = {
          ...payload,
          id,
          createdAt: Date.now(),
          read: false,
          ...(dedupeKey ? { dedupeKey } : {}),
        };
        set((s) => ({
          inbox: saveInbox ? [...s.inbox, item].slice(-MAX_INBOX) : s.inbox,
          toasts: [...s.toasts, item],
        }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, TOAST_MS);
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      markAllRead: () =>
        set((s) => ({
          inbox: s.inbox.map((i) => (i.read ? i : { ...i, read: true })),
        })),
    }),
    {
      name: 'restopos-notification-inbox',
      partialize: (s) => ({ inbox: s.inbox }),
    },
  ),
);

/** Primitive selector — safe for useSyncExternalStore. */
export function selectUnreadCount(state: NotificationState): number {
  let count = 0;
  for (const i of state.inbox) {
    if (!i.read) count += 1;
  }
  return count;
}
