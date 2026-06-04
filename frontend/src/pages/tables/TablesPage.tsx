import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { BookingFormModal } from '@/components/bookings/BookingFormModal';
import { TableCardMenu } from '@/components/tables/TableCardMenu';
import { FloorFilterBar } from '@/components/tables/FloorFilterBar';
import { FloorsManageModal } from '@/components/tables/FloorsManageModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import {
  useTables,
  useTablesWithWaiters,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  type TableStatus,
  type TableChargeType,
} from '@/hooks/useTables';
import { useScheduledBookingsByTable } from '@/hooks/useTableBookings';
import { isBookingArrivalDue } from '@/lib/bookingArrival';
import { useLiveSecond } from '@/hooks/useLiveSecond';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantId } from '@/contexts/AuthContext';
import { canCreateOrders, isCashier, isManager } from '@/lib/roles';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { FLOOR_FILTER_ALL, floorLabel, mergeFloors, type FloorFilter } from '@/lib/floors';
import { useRestaurantFloors } from '@/hooks/useFloors';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { t, tableStatus } from '@/i18n';

const statusColor: Record<string, 'green' | 'yellow' | 'blue' | 'gray'> = {
  FREE: 'green',
  OCCUPIED: 'yellow',
  RESERVED: 'blue',
  CLEANING: 'gray',
};

export function TablesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: openKassa } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();
  const restaurantId = useRestaurantId();
  const canManage = profile?.role && isManager(profile.role);
  const canOrder = canCreateOrders(profile?.role);
  const isKassaOwner = Boolean(
    openKassa &&
      ((openKassa.opened_by_profile_id && openKassa.opened_by_profile_id === profile?.id) ||
        (openKassa.opened_by_staff_id && myStaffId && openKassa.opened_by_staff_id === myStaffId)),
  );
  const cashierCreateBlocked = Boolean(profile?.role === 'CASHIER' && openKassa && !isKassaOwner);
  const { data: tables = [], isFetching, isError, error, refetch } = useTablesWithWaiters();
  const { data: allTables = [] } = useTables();
  const { data: bookingsByTable } = useScheduledBookingsByTable();
  const hasDueBookings = Boolean(
    bookingsByTable && [...bookingsByTable.values()].some((b) => isBookingArrivalDue(b.scheduled_at)),
  );
  useLiveSecond(hasDueBookings);
  const { data: configuredFloors = [] } = useRestaurantFloors();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();
  const notify = useNotificationStore((s) => s.add);

  const floors = useMemo(
    () => mergeFloors(configuredFloors, tables.map((t) => t.floor)),
    [configuredFloors, tables],
  );

  const [floorFilter, setFloorFilter] = useState<FloorFilter>(FLOOR_FILTER_ALL);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [floorsManageOpen, setFloorsManageOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [floor, setFloor] = useState('');
  const [status, setStatus] = useState<TableStatus>('FREE');
  const [chargeType, setChargeType] = useState<TableChargeType>('NONE');
  const [chargeAmount, setChargeAmount] = useState('');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingTableId, setBookingTableId] = useState<string | undefined>();

  const chargeTypeOptions = [
    { value: 'NONE', label: t('tables.chargeNone') },
    { value: 'ONE_TIME', label: t('tables.chargeOneTime') },
    { value: 'HOURLY', label: t('tables.chargeHourly') },
  ];

  const floorOptions = floors.map((f) => ({ value: f, label: f }));

  const filteredTables = useMemo(() => {
    if (floorFilter === FLOOR_FILTER_ALL) return tables;
    return tables.filter((t) => t.floor === floorFilter);
  }, [tables, floorFilter]);

  const floorCounts = useMemo(() => {
    const counts: Record<string, number> = { [FLOOR_FILTER_ALL]: tables.length };
    for (const f of floors) {
      counts[f] = tables.filter((t) => t.floor === f).length;
    }
    return counts;
  }, [tables, floors]);

  const goNewOrder = (tableId?: string) => {
    if (cashierCreateBlocked) {
      notify({ type: 'warning', title: t('kassa.openedByAnotherCashier') });
      return;
    }
    if (profile?.role && isCashier(profile.role)) {
      navigate('/orders/new');
      return;
    }
    navigate(tableId ? `/orders/new?table=${tableId}` : '/orders/new');
  };

  const openAdd = () => {
    setName('');
    setCapacity('4');
    setFloor(floors[0] ?? '');
    setStatus('FREE');
    setChargeType('NONE');
    setChargeAmount('');
    setEditId(null);
    setModal('add');
  };

  const openEdit = (t: {
    id: string;
    name: string;
    capacity: number;
    floor: string | null;
    status: string;
    charge_type?: string;
    charge_amount?: number;
  }) => {
    setEditId(t.id);
    setName(t.name);
    setCapacity(String(t.capacity));
    setFloor(t.floor && floors.includes(t.floor) ? t.floor : floors[0] ?? t.floor ?? '');
    setStatus(t.status as TableStatus);
    setChargeType((t.charge_type as TableChargeType) || 'NONE');
    setChargeAmount(t.charge_amount ? String(t.charge_amount) : '');
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const chargePayload = {
      charge_type: chargeType,
      charge_amount: chargeType === 'NONE' ? 0 : parseFloat(chargeAmount) || 0,
    };
    try {
      if (modal === 'add') {
        await createTable.mutateAsync({
          name,
          capacity: parseInt(capacity, 10),
          floor,
          ...chargePayload,
        });
        notify({ type: 'success', title: t('tables.tableAdded') });
      } else if (editId) {
        await updateTable.mutateAsync({
          id: editId,
          name,
          capacity: parseInt(capacity, 10),
          floor,
          status,
          ...chargePayload,
        });
        notify({ type: 'success', title: t('tables.tableUpdated') });
      }
      setModal(null);
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('tables.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (isFetching) return <Spinner />;

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('tables.title')}</h2>
        <Card className="max-w-lg space-y-3 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">{t('tables.loadFailed')}</p>
          <p className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(error)}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="page-title">{t('tables.title')}</h2>
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> {t('tables.addTable')}
          </Button>
        )}
      </div>

      <FloorFilterBar
        floors={floors}
        floorFilter={floorFilter}
        floorCounts={floorCounts}
        canManage={Boolean(canManage)}
        onFilterChange={setFloorFilter}
        onManageFloors={() => setFloorsManageOpen(true)}
      />

      {tables.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t('tables.noTables')}
          {canManage ? t('tables.noTablesManager') : t('tables.noTablesWaiter')}
        </p>
      ) : filteredTables.length === 0 ? (
        <p className="text-sm text-slate-500">{t('tables.noTablesFloor')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => (
            <Card key={table.id} className="@container flex flex-col p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 text-lg font-semibold leading-tight">{table.name}</h3>
                <div className="flex shrink-0 items-start gap-0.5">
                  <Badge color={statusColor[table.status] ?? 'gray'} size="sm">
                    {tableStatus(table.status)}
                  </Badge>
                  <TableCardMenu
                    canBook={Boolean(
                      canOrder &&
                        !table.openOrderId &&
                        !bookingsByTable?.has(table.id),
                    )}
                    canManage={Boolean(canManage)}
                    onBook={() => {
                      setBookingTableId(table.id);
                      setBookingModalOpen(true);
                    }}
                    onEdit={() => openEdit(table)}
                    onDelete={() => {
                      if (window.confirm(t('tables.deleteConfirm', { name: table.name }))) {
                        deleteTable.mutate(table.id, {
                          onError: (err) =>
                            notify({
                              type: 'error',
                              title: t('tables.deleteFailed'),
                              message: getErrorMessage(err),
                            }),
                        });
                      }
                    }}
                  />
                </div>
              </div>
              <dl className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('tables.floor')}</dt>
                  <dd className="font-medium">{floorLabel(table.floor)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('tables.seats')}</dt>
                  <dd className="font-medium">{table.capacity}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('tables.waiter')}</dt>
                  <dd className={table.waiterName ? 'font-medium text-primary-600' : 'text-slate-400'}>
                    {table.waiterName ?? '—'}
                  </dd>
                </div>
                {bookingsByTable?.get(table.id) && (() => {
                  const booking = bookingsByTable.get(table.id)!;
                  const due = isBookingArrivalDue(booking.scheduled_at);
                  return (
                    <div
                      className={
                        due
                          ? 'rounded-lg border border-amber-400 bg-amber-50 px-2 py-1.5 text-xs dark:border-amber-600 dark:bg-amber-950/50'
                          : 'rounded-lg bg-blue-50 px-2 py-1.5 text-xs dark:bg-blue-950/40'
                      }
                    >
                      {due && (
                        <p className="mb-1 font-semibold text-amber-900 dark:text-amber-100">
                          {t('bookings.callClientNow')}
                        </p>
                      )}
                      <p className={due ? 'font-medium text-amber-900 dark:text-amber-200' : 'font-medium text-blue-800 dark:text-blue-200'}>
                        {t('bookings.booker')}: {booking.customerName}
                      </p>
                      <p className={due ? 'text-amber-800/90 dark:text-amber-300/90' : 'text-blue-700/80 dark:text-blue-300/80'}>
                        {t('bookings.scheduledFor', {
                          time: format(new Date(booking.scheduled_at), 'dd.MM HH:mm'),
                        })}
                      </p>
                      {due && booking.customerPhone && (
                        <a
                          href={`tel:${booking.customerPhone.replace(/\s/g, '')}`}
                          className="mt-1 inline-block font-medium text-amber-900 underline dark:text-amber-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('bookings.callClient')}: {booking.customerPhone}
                        </a>
                      )}
                    </div>
                  );
                })()}
                {table.charge_type && table.charge_type !== 'NONE' && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t('tables.chargeLabel')}</dt>
                    <dd className="font-medium tabular-nums">
                      {table.charge_type === 'HOURLY'
                        ? t('tables.chargeHourlyShort', { amount: table.charge_amount ?? 0 })
                        : t('tables.chargeOnceShort', { amount: table.charge_amount ?? 0 })}
                    </dd>
                  </div>
                )}
              </dl>
              {canOrder && (table.openOrderId || table.status !== 'CLEANING') && (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {table.openOrderId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center whitespace-nowrap"
                      onClick={() => setViewOrderId(table.openOrderId)}
                    >
                      {t('tables.viewOrder')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full justify-center whitespace-nowrap"
                      disabled={cashierCreateBlocked}
                      onClick={() => goNewOrder(table.id)}
                    >
                      {t('tables.newOrder')}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <OrderDetailModal
        orderId={viewOrderId}
        open={viewOrderId !== null}
        onClose={() => setViewOrderId(null)}
      />

      {canOrder && (
        <BookingFormModal
          open={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          tables={allTables}
          initialTableId={bookingTableId}
        />
      )}

      {canManage && (
        <FloorsManageModal
          open={floorsManageOpen}
          onClose={() => setFloorsManageOpen(false)}
          floors={floors}
          floorCounts={floorCounts}
          onRenamed={(oldName, newName) => {
            if (floorFilter === oldName) setFloorFilter(newName);
          }}
        />
      )}

      {canManage && (
        <Modal
          open={modal !== null}
          onClose={() => setModal(null)}
          title={modal === 'add' ? t('tables.addTableTitle') : t('tables.editTableTitle')}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} required placeholder="T1" />
            <Input
              label={t('tables.capacity')}
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
            {floorOptions.length > 0 ? (
              <Select
                label={t('tables.floor')}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                options={floorOptions}
              />
            ) : (
              <Input
                label={t('tables.floor')}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder={t('tables.floorPlaceholder')}
              />
            )}
            <Select
              label={t('tables.chargeType')}
              value={chargeType}
              onChange={(e) => setChargeType(e.target.value as TableChargeType)}
              options={chargeTypeOptions}
            />
            {chargeType !== 'NONE' && (
              <Input
                label={chargeType === 'HOURLY' ? t('tables.chargeAmountHourly') : t('tables.chargeAmountOnce')}
                type="number"
                min="0"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                required
              />
            )}
            {modal === 'edit' && (
              <Select
                label={t('tables.statusLabel')}
                value={status}
                onChange={(e) => setStatus(e.target.value as TableStatus)}
                options={[
                  { value: 'FREE', label: tableStatus('FREE') },
                  { value: 'OCCUPIED', label: tableStatus('OCCUPIED') },
                  { value: 'RESERVED', label: tableStatus('RESERVED') },
                  { value: 'CLEANING', label: tableStatus('CLEANING') },
                ]}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={createTable.isPending || updateTable.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
