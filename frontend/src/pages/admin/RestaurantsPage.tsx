import { useState } from 'react';
import { Plus, Ban, CheckCircle, PauseCircle } from 'lucide-react';
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
  useUpdateRestaurantStatus,
  slugify,
  type RestaurantStatus,
} from '@/hooks/useRestaurants';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

const statusColor: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  ACTIVE: 'green',
  TRIAL: 'yellow',
  SUSPENDED: 'red',
  CANCELLED: 'gray',
};

export function RestaurantsPage() {
  const { data: restaurants, isLoading } = useRestaurants();
  const createRestaurant = useCreateRestaurant();
  const updateStatus = useUpdateRestaurantStatus();
  const notify = useNotificationStore((s) => s.add);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('FREE');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRestaurant.mutateAsync({
        name,
        slug: slug || slugify(name),
        email: email || undefined,
        phone: phone || undefined,
        subscription_plan: plan,
        status: 'TRIAL',
      });
      notify({ type: 'success', title: 'Restaurant created' });
      setModalOpen(false);
      setName('');
      setSlug('');
      setEmail('');
      setPhone('');
    } catch (err) {
      notify({ type: 'error', title: 'Failed', message: getErrorMessage(err) });
    }
  };

  const setRestaurantStatus = async (id: string, status: RestaurantStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      notify({ type: 'success', title: `Status: ${status}` });
    } catch (err) {
      notify({ type: 'error', title: 'Update failed', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Restaurants</h2>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add restaurant
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
                  {r.slug} · {r.subscription_plan}
                </p>
                {r.email && <p className="text-xs text-slate-400">{r.email}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={statusColor[r.status] ?? 'gray'}>{r.status}</Badge>
                {r.status !== 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRestaurantStatus(r.id, 'ACTIVE')}
                    loading={updateStatus.isPending}
                  >
                    <CheckCircle className="h-4 w-4" /> Activate
                  </Button>
                )}
                {r.status !== 'SUSPENDED' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setRestaurantStatus(r.id, 'SUSPENDED')}
                    loading={updateStatus.isPending}
                  >
                    <Ban className="h-4 w-4" /> Block
                  </Button>
                )}
                {r.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRestaurantStatus(r.id, 'TRIAL')}
                    loading={updateStatus.isPending}
                  >
                    <PauseCircle className="h-4 w-4" /> Set trial
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New restaurant">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            required
          />
          <Input
            label="Slug (URL)"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            required
          />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select
            label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            options={[
              { value: 'FREE', label: 'Free' },
              { value: 'STARTER', label: 'Starter' },
              { value: 'PROFESSIONAL', label: 'Professional' },
              { value: 'ENTERPRISE', label: 'Enterprise' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRestaurant.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
