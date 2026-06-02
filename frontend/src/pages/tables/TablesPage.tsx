import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import {
  useTablesWithWaiters,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  type TableStatus,
} from '@/hooks/useTables';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantId } from '@/contexts/AuthContext';
import { canCreateOrders, isCashier, isManager } from '@/lib/roles';
import { useOpenCashRegisterSession } from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { FLOOR_FILTER_ALL, DEFAULT_FLOORS, floorLabel, mergeFloors, type FloorFilter } from '@/lib/floors';
import { useRestaurantFloors, useAddRestaurantFloor } from '@/hooks/useFloors';
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
  const { data: configuredFloors = [...DEFAULT_FLOORS] } = useRestaurantFloors();
  const addFloor = useAddRestaurantFloor();
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
  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [floor, setFloor] = useState<string>(DEFAULT_FLOORS[0]);
  const [status, setStatus] = useState<TableStatus>('FREE');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

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
    setFloor(floors[0] ?? DEFAULT_FLOORS[0]);
    setStatus('FREE');
    setEditId(null);
    setModal('add');
  };

  const openEdit = (t: { id: string; name: string; capacity: number; floor: string | null; status: string }) => {
    setEditId(t.id);
    setName(t.name);
    setCapacity(String(t.capacity));
    setFloor(t.floor && floors.includes(t.floor) ? t.floor : floors[0] ?? DEFAULT_FLOORS[0]);
    setStatus(t.status as TableStatus);
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal === 'add') {
        await createTable.mutateAsync({
          name,
          capacity: parseInt(capacity, 10),
          floor,
        });
        notify({ type: 'success', title: t('tables.tableAdded') });
      } else if (editId) {
        await updateTable.mutateAsync({
          id: editId,
          name,
          capacity: parseInt(capacity, 10),
          floor,
          status,
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

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={floorFilter === FLOOR_FILTER_ALL ? 'primary' : 'secondary'}
          onClick={() => setFloorFilter(FLOOR_FILTER_ALL)}
        >
          {t('tables.allFloors')} ({floorCounts[FLOOR_FILTER_ALL]})
        </Button>
        {floors.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={floorFilter === f ? 'primary' : 'secondary'}
            onClick={() => setFloorFilter(f)}
          >
            {f} ({floorCounts[f] ?? 0})
          </Button>
        ))}
        {canManage && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setNewFloorName('');
              setFloorModalOpen(true);
            }}
            title={t('tables.addFloorTitle')}
            aria-label={t('tables.addFloorTitle')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

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
            <Card key={table.id} className="flex flex-col p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{table.name}</h3>
                <Badge color={statusColor[table.status] ?? 'gray'} size="sm">
                  {tableStatus(table.status)}
                </Badge>
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
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {canOrder && table.status === 'FREE' && (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={cashierCreateBlocked}
                    onClick={() => goNewOrder(table.id)}
                  >
                    {t('tables.newOrder')}
                  </Button>
                )}
                {canOrder && table.status === 'OCCUPIED' && table.openOrderId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setViewOrderId(table.openOrderId)}
                  >
                    {t('tables.viewOrder')}
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(table)} title={t('tables.editTable')}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t('tables.deleteTable')}
                      onClick={() => {
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
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <OrderDetailModal
        orderId={viewOrderId}
        open={viewOrderId !== null}
        onClose={() => setViewOrderId(null)}
      />

      {canManage && (
        <Modal open={floorModalOpen} onClose={() => setFloorModalOpen(false)} title={t('tables.addFloorTitle')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addFloor.mutate(newFloorName, {
                onSuccess: (list) => {
                  notify({ type: 'success', title: t('tables.floorAdded') });
                  setFloorModalOpen(false);
                  setNewFloorName('');
                  setFloorFilter(list[list.length - 1] ?? FLOOR_FILTER_ALL);
                },
                onError: (err) =>
                  notify({ type: 'error', title: t('tables.floorAddFailed'), message: getErrorMessage(err) }),
              });
            }}
            className="space-y-4"
          >
            <Input
              label={t('tables.floorName')}
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              placeholder={t('tables.floorPlaceholder')}
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setFloorModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={addFloor.isPending}>
                {t('common.add')}
              </Button>
            </div>
          </form>
        </Modal>
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
            <Select label={t('tables.floor')} value={floor} onChange={(e) => setFloor(e.target.value)} options={floorOptions} />
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
