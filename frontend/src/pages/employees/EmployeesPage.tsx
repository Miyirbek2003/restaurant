import { useState } from 'react';
import { Plus, Copy, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import {
  useEmployees,
  useCreateStaffMember,
  useUpdateStaffStatus,
  useDeleteStaffMember,
  type StaffRole,
} from '@/hooks/useEmployees';
import {
  useStaffInvites,
  useCreateStaffInvite,
  useRevokeStaffInvite,
  getJoinUrl,
} from '@/hooks/useStaffInvites';
import { useRestaurantId } from '@/contexts/AuthContext';
import { useWaiterPaidOrders, summarizeWaiterSales } from '@/hooks/useStaffSales';
import { useStockAlerts, useAcknowledgeStockAlert } from '@/hooks/useStockAlerts';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { t, roleLabel } from '@/i18n';

const statusBadge: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  ACTIVE: 'green',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
};

export function EmployeesPage() {
  const restaurantId = useRestaurantId();
  const { data: staff = [], isFetching } = useEmployees();
  const {
    data: invites = [],
    isFetching: loadingInvites,
    isError: invitesError,
    error: invitesLoadError,
  } = useStaffInvites();
  const createInvite = useCreateStaffInvite();
  const revokeInvite = useRevokeStaffInvite();
  const createStaff = useCreateStaffMember();
  const updateStatus = useUpdateStaffStatus();
  const deleteStaff = useDeleteStaffMember();
  const { data: paidOrders = [], isFetching: loadingSales } = useWaiterPaidOrders();
  const salesByWaiter = summarizeWaiterSales(paidOrders);
  const { data: stockAlerts = [] } = useStockAlerts();
  const acknowledgeAlert = useAcknowledgeStockAlert();
  const notify = useNotificationStore((s) => s.add);
  const pendingAlerts = stockAlerts.filter((a) => !a.acknowledged_at);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<StaffRole>('WAITER');
  const [inviteLabel, setInviteLabel] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('WAITER');

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('employees.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invite = await createInvite.mutateAsync({ role: inviteRole, label: inviteLabel || undefined });
      setLastInviteUrl(getJoinUrl(invite.code));
      notify({
        type: 'success',
        title: t('employees.inviteCreated'),
        message: t('employees.inviteCreatedMsg', { code: invite.code }),
      });
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(getJoinUrl(code));
    notify({ type: 'success', title: t('employees.linkCopied') });
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStaff.mutateAsync({ name, role, phone: phone || undefined });
      notify({ type: 'success', title: t('employees.staffAdded'), message: t('employees.staffAddedMsg', { name }) });
      setAddOpen(false);
      setName('');
      setPhone('');
      setRole('WAITER');
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const pendingInvites = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('employees.title')}</h2>
          <p className="text-sm text-slate-500">{t('employees.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t('employees.addStaff')}
          </Button>
          <Button variant="secondary" onClick={() => setInviteOpen(true)}>
            <Link2 className="h-4 w-4" /> {t('employees.inviteLink')}
          </Button>
        </div>
      </div>

      {invitesError && (
        <Card className="border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">{t('employees.invitesUnavailable')}</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{getErrorMessage(invitesLoadError)}</p>
        </Card>
      )}

      {lastInviteUrl && (
        <Card className="border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{t('employees.latestInviteLink')}</p>
          <p className="mt-1 break-all text-xs">{lastInviteUrl}</p>
          <Button
            size="sm"
            className="mt-2"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(lastInviteUrl);
              notify({ type: 'success', title: t('employees.linkCopied') });
            }}
          >
            <Copy className="h-3.5 w-3.5" /> {t('employees.copyLink')}
          </Button>
        </Card>
      )}

      {!loadingInvites && pendingInvites.length > 0 && (
        <CollapsibleSection
          title={t('employees.pendingInvites')}
          defaultOpen={false}
          badge={<Badge color="blue" size="sm">{pendingInvites.length}</Badge>}
        >
          <div className="overflow-x-auto">
            <table className="table-compact min-w-[480px]">
              <thead>
                <tr>
                  <th>{t('employees.code')}</th>
                  <th>{t('employees.role')}</th>
                  <th>{t('employees.expires')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono font-bold">{inv.code}</td>
                    <td>
                      <Badge color="blue" size="sm">{roleLabel(inv.role)}</Badge>
                    </td>
                    <td className="text-slate-500">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => copyLink(inv.code)}>
                          {t('employees.copy')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revokeInvite.mutate(inv.id)}>
                          {t('employees.revoke')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {pendingAlerts.length > 0 && (
        <CollapsibleSection
          title={t('employees.stockAlerts')}
          defaultOpen
          badge={<Badge color="yellow" size="sm">{pendingAlerts.length}</Badge>}
        >
          <div className="space-y-2">
            {pendingAlerts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20"
              >
                <div className="text-sm">
                  <p className="font-medium">{a.product_name}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t('employees.stockAlertLine', {
                      staff: a.staff_name ?? t('employees.staffFallback'),
                      requested: a.requested_qty,
                      available: a.available_qty,
                    })}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => acknowledgeAlert.mutate(a.id)}>
                  {t('employees.dismiss')}
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t('employees.waiterHistory')}
        description={t('employees.waiterHistoryDesc')}
        defaultOpen={false}
        badge={
          salesByWaiter.length > 0 ? (
            <Badge color="green" size="sm">{formatCurrency(salesByWaiter.reduce((s, w) => s + w.totalRevenue, 0))}</Badge>
          ) : undefined
        }
      >
        {loadingSales ? (
          <Spinner />
        ) : salesByWaiter.length === 0 ? (
          <p className="text-sm text-slate-500">{t('employees.noWaiterSales')}</p>
        ) : (
          <div className="space-y-3">
            {salesByWaiter.map((w) => (
              <CollapsibleSection
                key={w.staffId}
                title={w.staffName}
                description={t('employees.paidOrders', { n: w.paidOrderCount })}
                defaultOpen={false}
                badge={<Badge color="green" size="sm">{formatCurrency(w.totalRevenue)}</Badge>}
              >
                <div className="overflow-x-auto">
                  <table className="table-compact min-w-[420px]">
                    <thead>
                      <tr>
                        <th>{t('orders.table')}</th>
                        <th>{t('employees.orderNum')}</th>
                        <th>{t('employees.paid')}</th>
                        <th className="text-right">{t('orderDetail.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.orders.map((o) => (
                        <tr key={o.id}>
                          <td className="font-medium">{o.tableName}</td>
                          <td>#{o.orderNumber}</td>
                          <td className="text-slate-500">
                            {o.paidAt ? new Date(o.paidAt).toLocaleString() : '—'}
                          </td>
                          <td className="text-right font-medium">{formatCurrency(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-1 font-semibold">
                          {t('orderDetail.total')}
                        </td>
                        <td className="pt-1 text-right font-bold">{formatCurrency(w.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('employees.teamMembers')}
        defaultOpen
        badge={<Badge color="blue" size="sm">{staff.length}</Badge>}
      >
        {isFetching ? (
          <Spinner />
        ) : staff.length === 0 ? (
          <p className="text-slate-500">{t('employees.noStaff')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-compact min-w-[560px]">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('employees.role')}</th>
                  <th>{t('employees.phone')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-medium">{emp.name}</td>
                    <td>
                      <Badge color="blue" size="sm">
                        {emp.role === 'KITCHEN' ? t('employees.kitchen') : t('employees.waiter')}
                      </Badge>
                    </td>
                    <td className="text-slate-500">{emp.phone ?? '—'}</td>
                    <td>
                      <Badge color={statusBadge[emp.status] ?? 'gray'} size="sm">
                        {emp.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {emp.status !== 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateStatus.mutate({ staffId: emp.id, status: 'ACTIVE' })}
                          >
                            {t('employees.activate')}
                          </Button>
                        )}
                        {emp.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus.mutate({ staffId: emp.id, status: 'SUSPENDED' })}
                          >
                            {t('employees.deactivate')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (!window.confirm(t('employees.removeConfirm', { name: emp.name }))) return;
                            deleteStaff.mutate(emp.id, {
                              onSuccess: () => notify({ type: 'success', title: t('employees.removed') }),
                              onError: (err) =>
                                notify({ type: 'error', title: t('employees.removeFailed'), message: getErrorMessage(err) }),
                            });
                          }}
                        >
                          {t('employees.remove')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('employees.createInviteTitle')}>
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <p className="text-sm text-slate-500">{t('employees.inviteHint')}</p>
          <Select
            label={t('employees.role')}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as StaffRole)}
            options={[
              { value: 'WAITER', label: t('employees.waiter') },
              { value: 'KITCHEN', label: t('employees.kitchen') },
            ]}
          />
          <Input
            label={t('employees.labelOptional')}
            value={inviteLabel}
            onChange={(e) => setInviteLabel(e.target.value)}
            placeholder={t('employees.labelPlaceholder')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createInvite.isPending}>
              {t('employees.generateLink')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('employees.addMemberTitle')}>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label={t('employees.phoneOptional')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select
            label={t('employees.role')}
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            options={[
              { value: 'WAITER', label: t('employees.waiter') },
              { value: 'KITCHEN', label: t('employees.kitchen') },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createStaff.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
