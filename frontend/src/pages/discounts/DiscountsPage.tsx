import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResourceList, useResourceInsert, useResourceUpdate, useResourceDelete } from '@/hooks/useResource';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { t, discountType } from '@/i18n';

const TYPE_VALUES = ['PERCENTAGE', 'FIXED', 'COUPON', 'HAPPY_HOUR', 'VIP'] as const;

const TYPES = TYPE_VALUES.map((value) => ({
  value,
  label: discountType(value),
}));

type Discount = {
  id: string;
  name: string;
  type: string;
  value: number;
  coupon_code: string | null;
  min_order_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const empty = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  coupon_code: '',
  min_order_amount: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
};

function formatDiscountValue(type: string, value: number) {
  return type === 'PERCENTAGE' ? `${value}%` : formatCurrency(value);
}

export function DiscountsPage() {
  const { data = [], isLoading } = useResourceList<Discount>('discounts');
  const insert = useResourceInsert('discounts');
  const update = useResourceUpdate('discounts');
  const remove = useResourceDelete('discounts');
  const notify = useNotificationStore((s) => s.add);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (row: Discount) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      type: row.type,
      value: String(row.value),
      coupon_code: row.coupon_code ?? '',
      min_order_amount: row.min_order_amount != null ? String(row.min_order_amount) : '',
      starts_at: row.starts_at ? row.starts_at.slice(0, 16) : '',
      ends_at: row.ends_at ? row.ends_at.slice(0, 16) : '',
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      type: form.type,
      value: parseFloat(form.value),
      coupon_code: form.coupon_code || null,
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
    };
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, ...body });
        notify({ type: 'success', title: t('discounts.updated') });
      } else {
        await insert.mutateAsync(body);
        notify({ type: 'success', title: t('discounts.added') });
      }
      setOpen(false);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('discounts.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('discounts.add')}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={t('discounts.empty')} />
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{row.name}</p>
                  <Badge color={row.is_active ? 'green' : 'gray'} size="sm">
                    {row.is_active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {discountType(row.type)} · {formatDiscountValue(row.type, Number(row.value))}
                  {row.coupon_code ? ` · ${t('discounts.codePrefix', { code: row.coupon_code })}` : ''}
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
                    if (window.confirm(t('discounts.deleteConfirm', { name: row.name }))) {
                      remove.mutate(row.id);
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('discounts.edit') : t('discounts.new')} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label={t('discounts.type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TYPES} />
          <Input
            label={t('discounts.value')}
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
          />
          <Input
            label={t('discounts.coupon')}
            value={form.coupon_code}
            onChange={(e) => setForm({ ...form, coupon_code: e.target.value })}
          />
          <Input
            label={t('discounts.minOrder')}
            type="number"
            step="0.01"
            value={form.min_order_amount}
            onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
          />
          <Input
            label={t('discounts.startsAt')}
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          />
          <Input
            label={t('discounts.endsAt')}
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            {t('common.active')}
          </label>
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
