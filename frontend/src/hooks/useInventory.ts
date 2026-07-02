import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type InventoryItemType = 'KITCHEN' | 'SALE';

export type InventoryItemRow = {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  item_type: InventoryItemType;
  quantity: number;
  minimum_quantity: number;
  cost_per_unit: number;
  selling_price: number;
  product_id: string | null;
  image_url: string | null;
  category_id: string | null;
  products?: { id: string; is_active: boolean } | null;
};

export function isSaleInventoryItem(
  item: Pick<InventoryItemRow, 'item_type'> & {
    product_id?: string | null;
    selling_price?: number;
  },
): boolean {
  if (item.item_type) return item.item_type === 'SALE';
  return Boolean(item.product_id) || Number(item.selling_price) > 0;
}

const inventorySelect = '*, products(id, is_active)';

export function useInventoryItems() {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ['inventory_items', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(inventorySelect)
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as InventoryItemRow[];
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
      item_type: InventoryItemType;
      quantity?: number;
      minimum_quantity?: number;
      cost_per_unit: number;
      selling_price?: number;
      image_url?: string;
      category_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          name: body.name,
          unit: body.unit,
          item_type: body.item_type,
          quantity: body.quantity ?? 0,
          minimum_quantity: body.minimum_quantity ?? 0,
          cost_per_unit: body.cost_per_unit,
          selling_price: body.item_type === 'SALE' ? (body.selling_price ?? 0) : 0,
          image_url: body.image_url,
          category_id: body.item_type === 'SALE' ? body.category_id ?? null : null,
          restaurant_id: restaurantId!,
        })
        .select(inventorySelect)
        .single();
      if (error) throw error;
      return data as InventoryItemRow;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory_items'] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      unit?: string;
      item_type?: InventoryItemType;
      quantity?: number;
      minimum_quantity?: number;
      cost_per_unit?: number;
      selling_price?: number;
      image_url?: string | null;
      category_id?: string | null;
    }) => {
      if (body.item_type === 'KITCHEN') {
        body.selling_price = 0;
        body.category_id = null;
      }
      const { data, error } = await supabase
        .from('inventory_items')
        .update(body)
        .eq('id', id)
        .select(inventorySelect)
        .single();
      if (error) throw error;
      const row = data as InventoryItemRow;
      if (row.item_type === 'KITCHEN' && row.product_id) {
        await supabase.from('products').update({ is_active: false }).eq('id', row.product_id);
        await supabase.from('inventory_items').update({ product_id: null }).eq('id', id);
        row.product_id = null;
      }
      if (row.product_id) {
        await supabase
          .from('products')
          .update({
            name: row.name,
            price: Number(row.selling_price),
            cost_price: Number(row.cost_per_unit),
            stock_quantity: stockQtyFromInventory(Number(row.quantity), row.unit),
            image_url: row.image_url,
          })
          .eq('id', row.product_id);
      }
      return row;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

function stockQtyFromInventory(quantity: number, unit: string): number {
  if (unit === 'PIECE') return Math.max(0, Math.floor(quantity));
  return Math.max(0, Math.floor(quantity));
}

export function useToggleInventoryMenuVisibility() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item,
      visible,
      categoryId,
    }: {
      item: InventoryItemRow;
      visible: boolean;
      categoryId?: string;
    }) => {
      if (!restaurantId) throw new Error('No restaurant');

      const purchase = Number(item.cost_per_unit);
      const selling = Number(item.selling_price);
      const stockQty = stockQtyFromInventory(Number(item.quantity), item.unit);
      const catId = categoryId ?? item.category_id;

      if (item.item_type === 'KITCHEN') {
        throw new Error('KITCHEN_ITEM_NOT_FOR_MENU');
      }

      if (!visible) {
        if (item.product_id) {
          const { error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', item.product_id);
          if (error) throw error;
        }
        return;
      }

      if (!catId) throw new Error('SELECT_CATEGORY');

      if (item.product_id) {
        const { error } = await supabase
          .from('products')
          .update({
            name: item.name,
            price: selling,
            cost_price: purchase,
            stock_quantity: stockQty,
            image_url: item.image_url,
            is_active: true,
            category_id: catId,
          })
          .eq('id', item.product_id);
        if (error) throw error;
        await supabase.from('inventory_items').update({ category_id: catId }).eq('id', item.id);
        return;
      }

      const { data: product, error: pErr } = await supabase
        .from('products')
        .insert({
          restaurant_id: restaurantId,
          category_id: catId,
          name: item.name,
          price: selling,
          cost_price: purchase,
          stock_quantity: stockQty,
          image_url: item.image_url,
          is_active: true,
          tax_rate: 10,
        })
        .select('id')
        .single();
      if (pErr) throw pErr;

      const { error: linkErr } = await supabase
        .from('inventory_items')
        .update({ product_id: product.id, category_id: catId })
        .eq('id', item.id);
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export type InventoryPurchaseResult = {
  transaction_id: string;
  expense_id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  quantity_added: number;
  unit_cost: number;
  total_cost: number;
  quantity_before: number;
  quantity_after: number;
  expense_title: string;
  expense_category: string;
  expense_date: string;
  expense_amount: number;
  notes: string;
};

export type InventoryTransactionRow = {
  id: string;
  type: string;
  quantity: number;
  cost: number | null;
  notes: string | null;
  created_at: string;
  expense_id: string | null;
  inventory_items: { name: string; unit: string } | null;
  expenses: {
    id: string;
    title: string;
    amount: number;
    date: string;
    category: string;
    notes: string | null;
  } | null;
};

export function useInventoryPurchases(opts?: {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const restaurantId = useRestaurantId();
  const limit = opts?.limit ?? 100;
  return useQuery({
    queryKey: ['inventory_purchases', restaurantId, limit, opts?.dateFrom, opts?.dateTo],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('inventory_transactions')
        .select(
          'id, type, quantity, cost, notes, created_at, expense_id, inventory_items(name, unit), expenses(id, title, amount, date, category, notes)',
        )
        .eq('restaurant_id', restaurantId!)
        .eq('type', 'PURCHASE')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (opts?.dateFrom) {
        q = q.gte('created_at', `${opts.dateFrom}T00:00:00`);
      }
      if (opts?.dateTo) {
        q = q.lte('created_at', `${opts.dateTo}T23:59:59`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const inv = row.inventory_items;
        const exp = row.expenses;
        return {
          ...row,
          inventory_items: Array.isArray(inv) ? inv[0] : inv,
          expenses: Array.isArray(exp) ? exp[0] : exp,
        };
      }) as InventoryTransactionRow[];
    },
  });
}

export function useRecordInventoryPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      inventory_item_id: string;
      quantity: number;
      unit_cost?: number;
      date?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('record_inventory_purchase', {
        p_inventory_item_id: body.inventory_item_id,
        p_quantity: body.quantity,
        p_unit_cost: body.unit_cost ?? null,
        p_date: body.date ?? null,
        p_notes: body.notes ?? null,
      });
      if (error) throw error;
      return data as InventoryPurchaseResult;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['inventory_purchases'] });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useInventoryTransaction() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      inventory_item_id: string;
      type: 'USAGE' | 'ADJUSTMENT';
      quantity: number;
      notes?: string;
    }) => {
      const { data: item, error: iErr } = await supabase
        .from('inventory_items')
        .select('quantity, unit, product_id')
        .eq('id', body.inventory_item_id)
        .single();
      if (iErr) throw iErr;

      let newQty = Number(item.quantity);
      if (body.type === 'ADJUSTMENT') {
        newQty += body.quantity;
      } else {
        newQty -= body.quantity;
      }
      newQty = Math.max(0, newQty);

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
        .update({ quantity: newQty })
        .eq('id', body.inventory_item_id);
      if (uErr) throw uErr;

      if (item.product_id) {
        const stockQty = stockQtyFromInventory(newQty, item.unit);
        await supabase.from('products').update({ stock_quantity: stockQty }).eq('id', item.product_id);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useLinkProductToInventory() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!restaurantId) throw new Error('No restaurant');

      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('product_id', productId)
        .maybeSingle();
      if (existing) throw new Error('ALREADY_LINKED');

      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock_quantity, image_url, category_id, sale_unit')
        .eq('id', productId)
        .eq('restaurant_id', restaurantId)
        .single();
      if (pErr) throw pErr;

      const unit = product.sale_unit === 'KG' ? 'KG' : 'PIECE';
      const quantity = stockQtyFromInventory(Number(product.stock_quantity), unit);

      const { error } = await supabase.from('inventory_items').insert({
        restaurant_id: restaurantId,
        name: product.name,
        unit,
        item_type: 'SALE',
        quantity,
        minimum_quantity: 0,
        cost_per_unit: Number(product.cost_price) || 0,
        selling_price: Number(product.price) || 0,
        image_url: product.image_url,
        category_id: product.category_id,
        product_id: product.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['warehouse-product-ids'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUnlinkProductFromInventory() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!restaurantId) throw new Error('No restaurant');

      const { data: item, error: findErr } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('product_id', productId)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!item) throw new Error('NOT_ON_WAREHOUSE');

      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory_items'] });
      void qc.invalidateQueries({ queryKey: ['warehouse-product-ids'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useWarehouseProductIds() {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ['warehouse-product-ids', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('product_id')
        .eq('restaurant_id', restaurantId!)
        .not('product_id', 'is', null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.product_id as string));
    },
  });
}

export function inventoryProfit(item: {
  quantity: number;
  cost_per_unit: number;
  selling_price: number;
}) {
  const qty = Number(item.quantity);
  const purchase = Number(item.cost_per_unit);
  const selling = Number(item.selling_price);
  const marginPerUnit = selling - purchase;
  const totalCost = purchase * qty;
  const potentialRevenue = selling * qty;
  const profit = potentialRevenue - totalCost;
  return { marginPerUnit, totalCost, potentialRevenue, profit };
}
