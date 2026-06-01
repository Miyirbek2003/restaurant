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
import { formatCurrency } from '@/lib/utils';
import { t } from '@/i18n';

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  outstanding_balance: number;
};

const empty = { name: '', phone: '', email: '', address: '', notes: '' };

export function SuppliersPage() {
  const { data = [], isLoading } = useResourceList<Supplier>('suppliers');
  const insert = useResourceInsert('suppliers');
  const update = useResourceUpdate('suppliers');
  const remove = useResourceDelete('suppliers');
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (row: Supplier) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      notes: row.notes ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, ...body });
        notify({ type: 'success', title: t('suppliers.updated') });
      } else {
        await insert.mutateAsync(body);
        notify({ type: 'success', title: t('suppliers.added') });
      }
      setOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('suppliers.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('suppliers.add')}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={t('suppliers.empty')} />
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-slate-500">
                  {[row.phone, row.email].filter(Boolean).join(' · ') || '—'}
                </p>
                {row.address && <p className="text-sm text-slate-500">{row.address}</p>}
                {Number(row.outstanding_balance) > 0 && (
                  <p className="text-sm text-amber-600">
                    {t('suppliers.balance')}: {formatCurrency(Number(row.outstanding_balance))}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t('suppliers.deleteConfirm', { name: row.name }))) {
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('suppliers.edit') : t('suppliers.new')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('suppliers.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
