import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResourceList, useResourceInsert, useResourceUpdate, useResourceDelete } from '@/hooks/useResource';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  loyalty_points: number;
};

const empty = { name: '', phone: '', email: '', birthday: '', notes: '', loyalty_points: '0' };

export function CustomersPage() {
  const { data = [], isLoading } = useResourceList<Customer>('customers');
  const insert = useResourceInsert('customers');
  const update = useResourceUpdate('customers');
  const remove = useResourceDelete('customers');
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (row: Customer) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      phone: row.phone ?? '',
      email: row.email ?? '',
      birthday: row.birthday ?? '',
      notes: row.notes ?? '',
      loyalty_points: String(row.loyalty_points),
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      birthday: form.birthday || null,
      notes: form.notes || null,
      loyalty_points: parseInt(form.loyalty_points, 10) || 0,
    };
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, ...body });
        notify({ type: 'success', title: t('customers.updated') });
      } else {
        await insert.mutateAsync(body);
        notify({ type: 'success', title: t('customers.added') });
      }
      setOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('customers.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('customers.add')}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={t('customers.empty')} />
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-slate-500">
                  {[row.phone, row.email].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="text-sm text-primary-600">
                  {row.loyalty_points} {t('customers.loyaltyPoints')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t('customers.deleteConfirm', { name: row.name }))) {
                      remove.mutate(row.id, {
                        onError: (err) =>
                          notify({ type: 'error', title: t('common.deleteFailed'), message: getErrorMessage(err) }),
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('customers.edit') : t('customers.new')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('customers.birthday')} type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          <Input
            label={t('customers.loyaltyPoints')}
            type="number"
            value={form.loyalty_points}
            onChange={(e) => setForm({ ...form, loyalty_points: e.target.value })}
          />
          <Input label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={insert.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
