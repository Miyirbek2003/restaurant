import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInventoryItems, useCreateInventoryItem, useInventoryTransaction } from '@/hooks/useInventory';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';

const UNITS = [
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'LITER', label: 'liter' },
  { value: 'ML', label: 'ml' },
  { value: 'PIECE', label: 'piece' },
];

export function InventoryPage() {
  const { data: items, isLoading } = useInventoryItems();
  const createItem = useCreateInventoryItem();
  const stockTx = useInventoryTransaction();
  const notify = useNotificationStore((s) => s.add);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('KG');
  const [quantity, setQuantity] = useState('');
  const [minQty, setMinQty] = useState('');
  const [cost, setCost] = useState('');

  const [stockOpen, setStockOpen] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem.mutateAsync({
        name,
        unit,
        quantity: parseFloat(quantity) || 0,
        minimum_quantity: parseFloat(minQty) || 0,
        cost_per_unit: parseFloat(cost) || 0,
      });
      notify({ type: 'success', title: 'Item added' });
      setAddOpen(false);
      setName('');
      setQuantity('');
      setMinQty('');
      setCost('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  const handleStockIn = async (itemId: string) => {
    const q = parseFloat(stockQty);
    if (!q) return;
    try {
      await stockTx.mutateAsync({ inventory_item_id: itemId, type: 'PURCHASE', quantity: q });
      notify({ type: 'success', title: 'Stock updated' });
      setStockOpen(null);
      setStockQty('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Warehouse / Inventory</h2>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !items?.length ? (
        <EmptyState title="No inventory" description="Track ingredients and stock levels here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const low = Number(item.quantity) < Number(item.minimum_quantity);
            return (
              <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    {item.quantity} {item.unit} · min {item.minimum_quantity} · cost {item.cost_per_unit}/unit
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {low && <Badge color="red">Low stock</Badge>}
                  <Button size="sm" variant="secondary" onClick={() => setStockOpen(item.id)}>
                    Add stock
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New inventory item">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} options={UNITS} />
          <Input label="Quantity" type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Minimum quantity" type="number" step="0.001" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          <Input label="Cost per unit" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createItem.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!stockOpen} onClose={() => setStockOpen(null)} title="Add stock">
        <div className="space-y-4">
          <Input
            label="Quantity to add"
            type="number"
            step="0.001"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
          />
          <Button className="w-full" loading={stockTx.isPending} onClick={() => stockOpen && handleStockIn(stockOpen)}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
