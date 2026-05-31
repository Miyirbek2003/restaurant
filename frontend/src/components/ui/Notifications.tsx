import { X } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { cn } from '@/lib/utils';

const styles = {
  success: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50',
  error: 'border-red-500 bg-red-50 dark:bg-red-950/50',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-950/50',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-950/50',
};

export function Notifications() {
  const { items, remove } = useNotificationStore();
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {items.map((n) => (
        <div
          key={n.id}
          className={cn('flex min-w-[280px] items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg', styles[n.type])}
        >
          <div className="flex-1">
            <p className="font-medium">{n.title}</p>
            {n.message && <p className="mt-1 text-sm opacity-80">{n.message}</p>}
          </div>
          <button type="button" onClick={() => remove(n.id)} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
