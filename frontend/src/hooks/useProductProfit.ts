import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { buildProductProfitRows } from '@/lib/productProfit';

export function useProductProfitReport(dateFrom: string, dateTo: string) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['product-profit', restaurantId, dateFrom, dateTo],
    enabled: !!restaurantId,
    queryFn: async () => {
      const [productsRes, inventoryRes, itemsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, cost_price, price, categories(name)')
          .eq('restaurant_id', restaurantId!)
          .order('name'),
        supabase
          .from('inventory_items')
          .select(
            'id, name, item_type, product_id, cost_per_unit, selling_price, categories(name)',
          )
          .eq('restaurant_id', restaurantId!),
        supabase
          .from('order_items')
          .select(
            'product_id, product_name, quantity, unit_price, products(name, cost_price, categories(name)), orders!inner(status, paid_at)',
          )
          .eq('restaurant_id', restaurantId!)
          .eq('orders.status', 'PAID'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (itemsRes.error) throw itemsRes.error;

      return buildProductProfitRows(
        productsRes.data ?? [],
        inventoryRes.data ?? [],
        itemsRes.data ?? [],
        dateFrom,
        dateTo,
      );
    },
  });
}
