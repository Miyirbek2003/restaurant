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
import { canPlaceOrders, isManager } from '@/lib/roles';
import { FLOOR_FILTER_ALL, DEFAULT_FLOORS, floorLabel, mergeFloors, type FloorFilter } from '@/lib/floors';
import { useRestaurantFloors, useAddRestaurantFloor } from '@/hooks/useFloors';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

const statusColor: Record<string, 'green' | 'yellow' | 'blue' | 'gray'> = {
  FREE: 'green',
  OCCUPIED: 'yellow',
  RESERVED: 'blue',
  CLEANING: 'gray',
};

export function TablesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const canManage = profile?.role && isManager(profile.role);
  const canOrder = canPlaceOrders(profile?.role);
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
        notify({ type: 'success', title: 'Table added' });
      } else if (editId) {
        await updateTable.mutateAsync({
          id: editId,
          name,
          capacity: parseInt(capacity, 10),
          floor,
          status,
        });
        notify({ type: 'success', title: 'Table updated' });
      }
      setModal(null);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Tables</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (isFetching) return <Spinner />;

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Tables</h2>
        <Card className="max-w-lg space-y-3 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">Could not load tables</p>
          <p className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(error)}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Tables</h2>
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add table
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={floorFilter === FLOOR_FILTER_ALL ? 'primary' : 'secondary'}
          onClick={() => setFloorFilter(FLOOR_FILTER_ALL)}
        >
          All ({floorCounts[FLOOR_FILTER_ALL]})
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
            title="Add floor"
            aria-label="Add floor"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {tables.length === 0 ? (
        <p className="text-sm text-slate-500">
          No tables yet.
          {canManage ? ' Click Add table to create one.' : ' Ask your manager to add tables.'}
        </p>
      ) : filteredTables.length === 0 ? (
        <p className="text-sm text-slate-500">No tables on this floor. Try another filter or add a table.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="table-compact min-w-[640px]">
            <thead>
              <tr>
                <th>Table</th>
                <th>Floor</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Waiter</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTables.map((table) => (
                <tr key={table.id}>
                  <td className="font-semibold">{table.name}</td>
                  <td>{floorLabel(table.floor)}</td>
                  <td>{table.capacity}</td>
                  <td>
                    <Badge color={statusColor[table.status] ?? 'gray'} size="sm">
                      {table.status}
                    </Badge>
                  </td>
                  <td className="text-primary-600">{table.waiterName ?? '—'}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1">
                      {canOrder && table.status === 'FREE' && (
                        <Button size="sm" onClick={() => goNewOrder(table.id)}>
                          New order
                        </Button>
                      )}
                      {canOrder && table.status === 'OCCUPIED' && table.openOrderId && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/orders/${table.openOrderId}/edit`)}
                        >
                          View order
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(table)} title="Edit table">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Delete table"
                            onClick={() => {
                              if (window.confirm(`Delete table ${table.name}?`)) {
                                deleteTable.mutate(table.id, {
                                  onError: (err) =>
                                    notify({
                                      type: 'error',
                                      title: 'Delete failed',
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <Modal open={floorModalOpen} onClose={() => setFloorModalOpen(false)} title="Add floor">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addFloor.mutate(newFloorName, {
                onSuccess: (list) => {
                  notify({ type: 'success', title: 'Floor added' });
                  setFloorModalOpen(false);
                  setNewFloorName('');
                  setFloorFilter(list[list.length - 1] ?? FLOOR_FILTER_ALL);
                },
                onError: (err) =>
                  notify({ type: 'error', title: 'Could not add floor', message: getErrorMessage(err) }),
              });
            }}
            className="space-y-4"
          >
            <Input
              label="Floor name"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              placeholder="Terrace, VIP room…"
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setFloorModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={addFloor.isPending}>
                Add
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {canManage && (
        <Modal
          open={modal !== null}
          onClose={() => setModal(null)}
          title={modal === 'add' ? 'Add table' : 'Edit table'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="T1" />
            <Input
              label="Capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
            <Select label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} options={floorOptions} />
            {modal === 'edit' && (
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TableStatus)}
                options={[
                  { value: 'FREE', label: 'Free' },
                  { value: 'OCCUPIED', label: 'Occupied' },
                  { value: 'RESERVED', label: 'Reserved' },
                  { value: 'CLEANING', label: 'Cleaning' },
                ]}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={createTable.isPending || updateTable.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
