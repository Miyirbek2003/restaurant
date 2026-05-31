import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useCategories, useUpsertCategory, useToggleCategory } from '@/hooks/useProducts';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const upsert = useUpsertCategory();
  const toggleCategory = useToggleCategory();
  const notify = useNotificationStore((s) => s.add);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsert.mutateAsync({ name, description: description || undefined });
      notify({ type: 'success', title: 'Category saved' });
      setOpen(false);
      setName('');
      setDescription('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Menu categories</h2>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !categories?.length ? (
        <EmptyState title="No categories" description="Create categories before adding products." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="relative">
              <div className="absolute right-3 top-3">
                <Badge color={cat.is_active ? 'green' : 'gray'} size="sm">
                  {cat.is_active ? 'Active' : 'Off'}
                </Badge>
              </div>
              <h3 className="pr-14 font-semibold">{cat.name}</h3>
              {cat.description && <p className="mt-2 text-sm text-slate-500">{cat.description}</p>}
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => toggleCategory.mutate({ id: cat.id, is_active: !cat.is_active })}
              >
                {cat.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New category">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Drinks, Pizza..." />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={upsert.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
