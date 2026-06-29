import { Navigate, useParams } from 'react-router-dom';
import { CreateOrderPage } from '@/pages/orders/CreateOrderPage';
import { canEditOrderItems } from '@/lib/orderEdit';
import { useOrder } from '@/hooks/useOrders';
import { Spinner } from '@/components/ui/Spinner';
import type { OrderStatus } from '@/types';

export function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id);

  if (!id) return <Navigate to="/orders" replace />;

  if (isLoading) return <Spinner />;

  if (!order || !canEditOrderItems(order.status as OrderStatus)) {
    return <Navigate to="/orders" replace />;
  }

  return <CreateOrderPage orderId={id} />;
}
