import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Ban, CheckCircle, PauseCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useRestaurants,
  useCreateRestaurant,
  useUpdateRestaurant,
  useUpdateRestaurantStatus,
  slugify,
  type RestaurantStatus,
  type RestaurantWithManager,
} from '@/hooks/useRestaurants';
import { ensureRestaurantManager } from '@/lib/adminPlatform';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

const statusColor: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  ACTIVE: 'green',
  TRIAL: 'yellow',
  SUSPENDED: 'red',
  CANCELLED: 'gray',
};

const PLAN_OPTIONS = [
  { value: 'FREE', label: 'Free' },
  { value: 'STARTER', label: 'Starter' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const STATUS_OPTIONS: { value: RestaurantStatus; label: string }[] = [
  { value: 'TRIAL', label: 'TRIAL' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'SUSPENDED', label: 'SUSPENDED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'KGS', label: 'KGS' },
  { value: 'KZT', label: 'KZT' },
  { value: 'RUB', label: 'RUB' },
  { value: 'UZS', label: 'UZS' },
];

export function RestaurantsPage() {
  const qc = useQueryClient();
  const { data: restaurants, isLoading } = useRestaurants();
  const createRestaurant = useCreateRestaurant();
  const updateRestaurant = useUpdateRestaurant();
  const updateStatus = useUpdateRestaurantStatus();
  const notify = useNotificationStore((s) => s.add);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editingHasManager, setEditingHasManager] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [status, setStatus] = useState<RestaurantStatus>('TRIAL');
  const [currency, setCurrency] = useState('USD');
  const [managerName, setManagerName] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [linkExistingManager, setLinkExistingManager] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = editId !== null;
  const showManagerSetup = !isEdit || !editingHasManager;

  const resetForm = () => {
    setEditId(null);
    setEditingHasManager(false);
    setSlugTouched(false);
    setName('');
    setSlug('');
    setEmail('');
    setPhone('');
    setAddress('');
    setPlan('FREE');
    setStatus('TRIAL');
    setCurrency('USD');
    setManagerName('');
    setManagerPassword('');
    setLinkExistingManager(false);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (r: RestaurantWithManager) => {
    setEditId(r.id);
    setEditingHasManager(Boolean(r.manager));
    setSlugTouched(true);
    setName(r.name);
    setSlug(r.slug);
    setEmail(r.email ?? r.manager?.email ?? '');
    setPhone(r.phone ?? '');
    setAddress(r.address ?? '');
    setPlan(r.subscription_plan);
    setStatus(r.status);
    setCurrency(r.currency ?? 'USD');
    setManagerName(r.manager?.name ?? '');
    setManagerPassword('');
    setLinkExistingManager(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const setupManager = async (restaurantId: string) => {
    const loginEmail = email.trim();
    if (!loginEmail) return;

    await ensureRestaurantManager(restaurantId, {
      email: loginEmail,
      name: managerName.trim() || name.trim(),
      password: managerPassword,
      linkExisting: linkExistingManager,
    });
    await qc.invalidateQueries({ queryKey: ['restaurants'] });
    notify({ type: 'success', title: t('admin.managerCreated') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        slug: slug || slugify(name),
        email: email.trim() || null,
        phone: phone || null,
        address: address || null,
        subscription_plan: plan,
        status,
        currency,
      };

      if (isEdit && editId) {
        await updateRestaurant.mutateAsync({ id: editId, ...payload });
        if (showManagerSetup && email.trim()) {
          await setupManager(editId);
        }
        notify({ type: 'success', title: t('admin.restaurantUpdated') });
      } else {
        const restaurant = await createRestaurant.mutateAsync({
          ...payload,
          status: 'TRIAL',
        });
        if (email.trim()) {
          await setupManager(restaurant.id);
        }
        notify({ type: 'success', title: t('admin.restaurantCreated') });
      }

      closeModal();
    } catch (err) {
      notify({
        type: 'error',
        title: isEdit ? t('admin.updateFailed') : t('admin.createFailed'),
        message: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const setRestaurantStatus = async (id: string, nextStatus: RestaurantStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status: nextStatus });
      notify({ type: 'success', title: t('admin.statusUpdated', { status: nextStatus }) });
    } catch (err) {
      notify({ type: 'error', title: t('admin.updateFailed'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="page-title">{t('admin.restaurantsTitle')}</h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin.addRestaurant')}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {(restaurants ?? []).map((r) => (
            <Card key={r.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-slate-500">
                  {r.slug} · {r.subscription_plan} · {r.currency}
                </p>
                {r.manager ? (
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    {t('admin.managerLogin', { email: r.manager.email ?? '—' })}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{t('admin.noManagerYet')}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={statusColor[r.status] ?? 'gray'}>{r.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title={t('common.edit')}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {r.status !== 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRestaurantStatus(r.id, 'ACTIVE')}
                    loading={updateStatus.isPending}
                  >
                    <CheckCircle className="h-4 w-4" /> {t('admin.activate')}
                  </Button>
                )}
                {r.status !== 'SUSPENDED' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setRestaurantStatus(r.id, 'SUSPENDED')}
                    loading={updateStatus.isPending}
                  >
                    <Ban className="h-4 w-4" /> {t('admin.block')}
                  </Button>
                )}
                {r.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRestaurantStatus(r.id, 'TRIAL')}
                    loading={updateStatus.isPending}
                  >
                    <PauseCircle className="h-4 w-4" /> {t('admin.setTrial')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={isEdit ? t('admin.editRestaurant') : t('admin.newRestaurant')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('common.name')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
          <Input
            label={t('admin.slug')}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            required
          />

          <div>
            <Input
              label={t('admin.restaurantEmailLogin')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isEdit}
            />
            <p className="mt-1 text-xs text-slate-500">{t('admin.restaurantEmailHint')}</p>
          </div>

          <Input label={t('common.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t('admin.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
          <Select
            label={t('admin.plan')}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            options={PLAN_OPTIONS}
          />
          {isEdit && (
            <Select
              label={t('admin.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as RestaurantStatus)}
              options={STATUS_OPTIONS}
            />
          )}
          <Select
            label={t('admin.currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCY_OPTIONS}
          />

          {showManagerSetup && email.trim() && (
            <>
              <hr className="border-slate-200 dark:border-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admin.managerSection')}</p>

              <Input
                label={t('admin.managerName')}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder={name}
              />
              <p className="-mt-2 text-xs text-slate-500">{t('admin.managerNameHint')}</p>
              <p className="text-xs text-slate-500">{t('admin.createManagerHint')}</p>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linkExistingManager}
                  onChange={(e) => setLinkExistingManager(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {t('admin.linkExistingManager')}
              </label>
              {!linkExistingManager && (
                <Input
                  label={t('admin.managerPassword')}
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  required
                  minLength={6}
                />
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={submitting || createRestaurant.isPending || updateRestaurant.isPending}
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
