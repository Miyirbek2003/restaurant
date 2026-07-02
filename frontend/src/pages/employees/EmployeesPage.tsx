import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
  useSetStaffPin,
  useClearStaffPin,
  type StaffRole,
  type RestaurantStaff,
} from '@/hooks/useEmployees';
import { useRestaurantId } from '@/contexts/AuthContext';
import { useWaiterPaidOrders, summarizeWaiterSales } from '@/hooks/useStaffSales';
import { useStockAlerts, useAcknowledgeStockAlert } from '@/hooks/useStockAlerts';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { matchesDateRange } from '@/lib/filters';
import { DateRangeToolbar, type DateRangeValue } from '@/components/ui/DateRangeToolbar';
import { t, roleLabel } from '@/i18n';

const statusBadge: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  ACTIVE: 'green',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
};

export function EmployeesPage() {
  const restaurantId = useRestaurantId();
  const { data: staff = [], isFetching } = useEmployees();
  const createStaff = useCreateStaffMember();
  const updateStatus = useUpdateStaffStatus();
  const deleteStaff = useDeleteStaffMember();
  const setStaffPin = useSetStaffPin();
  const clearStaffPin = useClearStaffPin();
  const [pinTarget, setPinTarget] = useState<RestaurantStaff | null>(null);
  const [pinValue, setPinValue] = useState('');
  const { data: paidOrders = [], isFetching: loadingSales } = useWaiterPaidOrders();
  const [salesDateFilters, setSalesDateFilters] = useState<DateRangeValue>({
    dateFrom: '',
    dateTo: '',
  });

  const filteredPaidOrders = useMemo(
    () =>
      paidOrders.filter((o) =>
        matchesDateRange(o.paid_at, salesDateFilters.dateFrom, salesDateFilters.dateTo),
      ),
    [paidOrders, salesDateFilters.dateFrom, salesDateFilters.dateTo],
  );
  const salesByWaiter = useMemo(() => summarizeWaiterSales(filteredPaidOrders), [filteredPaidOrders]);
  const filteredSalesTotal = useMemo(
    () => salesByWaiter.reduce((s, w) => s + w.totalRevenue, 0),
    [salesByWaiter],
  );

  const { data: stockAlerts = [] } = useStockAlerts();
  const acknowledgeAlert = useAcknowledgeStockAlert();
  const notify = useNotificationStore((s) => s.add);
  const pendingAlerts = stockAlerts.filter((a) => !a.acknowledged_at);

  const [addOpen, setAddOpen] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('WAITER');

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('employees.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStaff.mutateAsync({
        name,
        role,
        phone,
        email: role === 'WAITER' || role === 'CASHIER' ? email : undefined,
      });
      notify({ type: 'success', title: t('employees.staffAdded'), message: t('employees.staffAddedMsg', { name }) });
      setAddOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setRole('WAITER');
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const needsEmail = role === 'WAITER' || role === 'CASHIER';

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
        </div>
      </div>

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
          filteredSalesTotal > 0 ? (
            <Badge color="green" size="sm">{formatCurrency(filteredSalesTotal)}</Badge>
          ) : undefined
        }
      >
        {loadingSales ? (
          <Spinner />
        ) : paidOrders.length === 0 ? (
          <p className="text-sm text-slate-500">{t('employees.noWaiterSales')}</p>
        ) : (
          <div className="space-y-3">
            <DateRangeToolbar
              value={salesDateFilters}
              onChange={setSalesDateFilters}
              showQuickFilters
              showMonthSwitcher
              onReset={() => setSalesDateFilters({ dateFrom: '', dateTo: '' })}
            />
            {salesByWaiter.length === 0 ? (
              <p className="text-sm text-slate-500">{t('filters.noResults')}</p>
            ) : (
              salesByWaiter.map((w) => (
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
              ))
            )}
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
                  <th>{t('terminal.pin')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-medium">{emp.name}</td>
                    <td>
                      <Badge color="blue" size="sm">
                        {roleLabel(emp.role)}
                      </Badge>
                    </td>
                    <td className="text-slate-500">{emp.phone ?? '—'}</td>
                    <td>
                      <Badge color={statusBadge[emp.status] ?? 'gray'} size="sm">
                        {emp.status}
                      </Badge>
                    </td>
                    <td>
                      {emp.role === 'KITCHEN' ? (
                        <span className="text-slate-400">—</span>
                      ) : !emp.auth_user_id ? (
                        <span className="text-xs text-slate-400" title={t('terminal.pinNeedsAuth')}>
                          {t('terminal.pinNeedsAuth')}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge color={emp.pin_set_at ? 'green' : 'gray'} size="sm">
                            {emp.pin_set_at ? t('terminal.pinSet') : t('terminal.pinNotSet')}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPinTarget(emp);
                              setPinValue('');
                            }}
                          >
                            {emp.pin_set_at ? t('terminal.changePin') : t('terminal.setPin')}
                          </Button>
                          {emp.pin_set_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                clearStaffPin.mutate(emp.id, {
                                  onSuccess: () =>
                                    notify({ type: 'success', title: t('terminal.pinCleared') }),
                                  onError: (err) =>
                                    notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
                                })
                              }
                            >
                              {t('terminal.clearPin')}
                            </Button>
                          )}
                        </div>
                      )}
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

      <Modal
        open={pinTarget !== null}
        onClose={() => setPinTarget(null)}
        title={pinTarget ? `${t('terminal.setPin')} — ${pinTarget.name}` : t('terminal.setPin')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pinTarget) return;
            if (!/^[0-9]{4,6}$/.test(pinValue)) {
              notify({ type: 'error', title: t('terminal.pinInvalid') });
              return;
            }
            setStaffPin.mutate(
              { staffId: pinTarget.id, pin: pinValue },
              {
                onSuccess: () => {
                  notify({ type: 'success', title: t('terminal.pinSaved') });
                  setPinTarget(null);
                  setPinValue('');
                },
                onError: (err) =>
                  notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
              },
            );
          }}
          className="space-y-4"
        >
          <Input
            label={t('terminal.pin')}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            required
          />
          <p className="text-xs text-slate-500">{t('terminal.pinDigitsHint')}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPinTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={setStaffPin.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('employees.addMemberTitle')}>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <p className="text-sm text-slate-500">{t('employees.addMemberHint')}</p>
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label={t('employees.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Select
            label={t('employees.role')}
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            options={[
              { value: 'WAITER', label: t('employees.waiter') },
              { value: 'KITCHEN', label: t('employees.kitchen') },
              { value: 'CASHIER', label: t('employees.cashier') },
            ]}
          />
          {needsEmail && (
            <Input
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
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
