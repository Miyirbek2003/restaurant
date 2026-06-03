import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useOrder, useAddOrderItem, useRemoveOrderItem, useSendToKitchen } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/utils';
import { orderItemName } from '@/lib/orderItem';
import { t } from '@/i18n';

export function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const { data: products } = useProducts(undefined, true);
  const addItem = useAddOrderItem();
  const removeItem = useRemoveOrderItem();
  const sendKitchen = useSendToKitchen();
  const [addingId, setAddingId] = useState<string | null>(null);

  if (isLoading || !order) return <Spinner />;
  if (order.status !== 'DRAFT') {
    navigate('/orders');
    return null;
  }

  const items = (order.order_items ?? []) as Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products?: { name: string } | null;
  }>;

  const addProduct = async (productId: string) => {
    setAddingId(productId);
    await addItem.mutateAsync({ orderId: order.id, productId, quantity: 1 });
    setAddingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Button>
        <h2 className="text-2xl font-bold">{t('orders.editOrder', { n: order.order_number })}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="font-semibold">{t('orders.currentItems')}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">{t('orders.noItems')}</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span>
                  {item.quantity}x {orderItemName(item)} — {formatCurrency(Number(item.unit_price) * item.quantity)}
                </span>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => removeItem.mutate({ itemId: item.id, orderId: order.id })}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
          <p className="font-bold">
            {t('orders.totalLabel')}: {formatCurrency(Number(order.total))}
          </p>
          <Button
            className="w-full"
            loading={sendKitchen.isPending && sendKitchen.variables === order.id}
            onClick={() => sendKitchen.mutate(order.id)}
          >
            {t('orders.sendToKitchen')}
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">{t('orders.addProducts')}</h3>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {(products ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={addingId === p.id}
                onClick={() => addProduct(p.id)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:border-primary-500 dark:border-slate-700"
              >
                <span>{p.name}</span>
                <span className="flex items-center gap-2">
                  {formatCurrency(Number(p.price))}
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
