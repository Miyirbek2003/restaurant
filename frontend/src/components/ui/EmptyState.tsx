import { Inbox } from 'lucide-react';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
      <Inbox className="mb-4 h-12 w-12 opacity-50" />
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm">{description}</p>}
    </div>
  );
}
