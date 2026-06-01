import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type CollapsibleSectionProps = {
  title: string;
  /** @deprecated use subtitle */
  description?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CollapsibleSection({
  title,
  description,
  subtitle,
  defaultOpen = false,
  badge,
  children,
  className,
}: CollapsibleSectionProps) {
  const hint = subtitle ?? description;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900', className)}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {badge}
          </div>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
      </button>
      {open && <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-800 sm:px-5">{children}</div>}
    </section>
  );
}
