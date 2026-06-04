import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Calendar, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

type TableCardMenuProps = {
  canBook: boolean;
  canManage: boolean;
  onBook: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function TableCardMenu({ canBook, canManage, onBook, onEdit, onDelete }: TableCardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!canBook && !canManage) return null;

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={t('tables.moreActions')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {canBook && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => { onBook(); setOpen(false); }}>
              <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
              {t('bookings.bookTable')}
            </button>
          )}
          {canManage && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => { onEdit(); setOpen(false); }}>
              <Pencil className="h-4 w-4 shrink-0 text-slate-500" />
              {t('common.edit')}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40')}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              {t('common.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
