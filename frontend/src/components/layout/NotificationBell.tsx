import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bell } from 'lucide-react';
import { selectUnreadCount, useNotificationStore, type NotificationType } from '@/stores/notificationStore';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

const typeDot: Record<NotificationType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = useNotificationStore(selectUnreadCount);
  const inbox = useNotificationStore((s) => s.inbox);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const recent = useMemo(
    () => [...inbox].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [inbox],
  );

  useEffect(() => {
    if (!open) return;
    markAllRead();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, markAllRead]);

  const toggle = () => setOpen((was) => !was);

  const badge =
    unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="touch-target relative rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={t('common.notifications')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <p className="text-sm font-semibold">{t('common.notifications')}</p>
          </div>
          {recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">{t('common.notificationsEmpty')}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {recent.map((n) => (
                <li key={n.id} className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', typeDot[n.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {format(n.createdAt, 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
