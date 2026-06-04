import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAddRestaurantFloor, useRenameRestaurantFloor } from '@/hooks/useFloors';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

type FloorsManageModalProps = {
  open: boolean;
  onClose: () => void;
  floors: string[];
  floorCounts: Record<string, number>;
  onRenamed?: (oldName: string, newName: string) => void;
};

export function FloorsManageModal({
  open,
  onClose,
  floors,
  floorCounts,
  onRenamed,
}: FloorsManageModalProps) {
  const addFloor = useAddRestaurantFloor();
  const renameFloor = useRenameRestaurantFloor();
  const notify = useNotificationStore((s) => s.add);

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addFloor.mutate(newName, {
      onSuccess: () => {
        notify({ type: 'success', title: t('tables.floorAdded') });
        setNewName('');
      },
      onError: (err) =>
        notify({ type: 'error', title: t('tables.floorAddFailed'), message: getErrorMessage(err) }),
    });
  };

  const handleRename = (oldName: string) => {
    renameFloor.mutate(
      { oldName, newName: editValue },
      {
        onSuccess: () => {
          notify({ type: 'success', title: t('tables.floorRenamed') });
          onRenamed?.(oldName, editValue.trim());
          cancelEdit();
        },
        onError: (err) =>
          notify({ type: 'error', title: t('tables.floorRenameFailed'), message: getErrorMessage(err) }),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={t('tables.manageFloorsTitle')} className="max-w-md">
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <Input
          className="min-w-0 flex-1"
          label={t('tables.addFloorTitle')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('tables.floorPlaceholder')}
        />
        <Button type="submit" className="mt-6 shrink-0" loading={addFloor.isPending} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {floors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
          {t('tables.noFloorsYet')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {floors.map((name) => {
            const isEditing = editing === name;
            const count = floorCounts[name] ?? 0;

            return (
              <li key={name} className="flex items-center gap-2 px-3 py-2.5">
                {isEditing ? (
                  <>
                    <Input
                      className="min-w-0 flex-1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      loading={renameFloor.isPending}
                      disabled={!editValue.trim()}
                      onClick={() => handleRename(name)}
                    >
                      {t('common.save')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {count}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title={t('tables.editFloorTitle')}
                      onClick={() => startEdit(name)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
