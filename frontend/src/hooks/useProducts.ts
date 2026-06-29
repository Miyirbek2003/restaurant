import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import { roundWeightKg } from '@/lib/weight';

function inventoryQtyFromProductStock(stockQuantity: number, saleUnit?: string): number {
  if (saleUnit === 'KG') return Math.max(0, roundWeightKg(stockQuantity));
  return Math.max(0, Math.floor(stockQuantity));
}

export function useProducts(search?: string, activeOnly = false) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['products', restaurantId, search, activeOnly],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('*, categories(name)')
        .eq('restaurant_id', restaurantId!)
        .order('name');

      if (activeOnly) q = q.eq('is_active', true);
      if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategories() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['categories', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProduct() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      name: string;
      category_id: string;
      price: number;
      sku?: string;
      cost_price?: number;
      tax_rate?: number;
      description?: string;
      is_active?: boolean;
      image_url?: string;
      stock_quantity?: number;
      sale_unit?: 'PIECE' | 'KG';
    }) => {
      if (!restaurantId) {
        throw new Error('No restaurant assigned to your account. Link restaurant_id in profiles table.');
      }
      if (!body.category_id) {
        throw new Error('Please select a category.');
      }

      const { data, error } = await supabase
        .from('products')
        .insert({ ...body, restaurant_id: restaurantId })
        .select('*, categories(name)')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      category_id?: string;
      price?: number;
      sku?: string;
      is_active?: boolean;
      cost_price?: number;
      tax_rate?: number;
      description?: string;
      image_url?: string;
      stock_quantity?: number;
      sale_unit?: 'PIECE' | 'KG';
    }) => {
      const { data, error } = await supabase.from('products').update(body).eq('id', id).select().single();
      if (error) throw error;

      if (body.stock_quantity !== undefined) {
        const invQty = inventoryQtyFromProductStock(body.stock_quantity, data.sale_unit);
        const { error: invErr } = await supabase
          .from('inventory_items')
          .update({ quantity: invQty })
          .eq('product_id', id);
        if (invErr) throw invErr;
      }

      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
    },
  });
}

export function useToggleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_menu_product', { p_product_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['warehouse-product-ids'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_menu_category', { p_category_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['warehouse-product-ids'] });
    },
  });
}

export function useUpsertCategory() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      id?: string;
      name: string;
      description?: string;
      sort_order?: number;
      image_url?: string;
    }) => {
      if (!restaurantId) {
        throw new Error('No restaurant assigned to your account.');
      }
      if (body.id) {
        const { data, error } = await supabase
          .from('categories')
          .update({
            name: body.name,
            description: body.description,
            sort_order: body.sort_order,
            image_url: body.image_url,
          })
          .eq('id', body.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: body.name,
          description: body.description,
          sort_order: body.sort_order ?? 0,
          image_url: body.image_url,
          restaurant_id: restaurantId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
