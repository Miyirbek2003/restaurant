import { cn } from '@/lib/utils';

const colors: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function Badge({
  children,
  color = 'gray',
  size = 'sm',
  className,
}: {
  children: React.ReactNode;
  color?: keyof typeof colors;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded font-medium leading-none',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px] uppercase tracking-wide' : 'rounded-full px-2.5 py-0.5 text-xs',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
