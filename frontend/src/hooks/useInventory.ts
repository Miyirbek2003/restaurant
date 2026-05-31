import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export function useInventoryItems() {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ['inventory_items', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInventoryItem() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      unit: string;
      quantity: number;
      minimum_quantity: number;
      cost_per_unit: number;
    }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ ...body, restaurant_id: restaurantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_items'] }),
  });
}

export function useInventoryTransaction() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      inventory_item_id: string;
      type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT';
      quantity: number;
      notes?: string;
    }) => {
      const { data: item, error: iErr } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', body.inventory_item_id)
        .single();
      if (iErr) throw iErr;

      let newQty = Number(item.quantity);
      if (body.type === 'PURCHASE' || body.type === 'ADJUSTMENT') {
        newQty += body.quantity;
      } else {
        newQty -= body.quantity;
      }

      const { error: tErr } = await supabase.from('inventory_transactions').insert({
        restaurant_id: restaurantId!,
        inventory_item_id: body.inventory_item_id,
        type: body.type,
        quantity: body.quantity,
        notes: body.notes,
      });
      if (tErr) throw tErr;

      const { error: uErr } = await supabase
        .from('inventory_items')
        .update({ quantity: Math.max(0, newQty) })
        .eq('id', body.inventory_item_id);
      if (uErr) throw uErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_items'] }),
  });
}
