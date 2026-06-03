import { matchesDateRange } from '@/lib/filters';

function isSaleInventoryItem(inv: InventorySeed): boolean {
  if (inv.item_type) return inv.item_type === 'SALE';
  return Boolean(inv.product_id) || Number(inv.selling_price) > 0;
}

export type ProductProfitRow = {
  key: string;
  id: string;
  name: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  /** Realized profit from sales in the period. */
  profit: number;
  /** listPrice − unitCost (one unit). */
  unitProfit: number;
  marginPct: number | null;
  unitCost: number;
  listPrice: number;
};

export function unitMarginPct(listPrice: number, unitProfit: number): number | null {
  if (listPrice <= 0) return null;
  return (unitProfit / listPrice) * 100;
}

/** Profit shown in the table: realized total or per-unit when nothing sold. */
export function displayProfit(row: ProductProfitRow): number {
  return row.quantitySold > 0 ? row.profit : row.unitProfit;
}

export function displayMarginPct(row: ProductProfitRow): number | null {
  if (row.quantitySold > 0) return row.marginPct;
  return unitMarginPct(row.listPrice, row.unitProfit);
}

type CategoryJoin = { name: string } | { name: string }[] | null | undefined;

type ProductSeed = {
  id: string;
  name: string;
  cost_price: number;
  price: number;
  categories?: CategoryJoin;
};

type InventorySeed = {
  id: string;
  name: string;
  item_type?: string;
  product_id: string | null;
  cost_per_unit: number;
  selling_price: number;
  categories?: CategoryJoin;
};

type OrderItemSeed = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  products?:
    | { name: string; cost_price: number; categories?: CategoryJoin }
    | { name: string; cost_price: number; categories?: CategoryJoin }[]
    | null;
  orders?: { status: string; paid_at: string | null } | { status: string; paid_at: string | null }[];
};

function unwrap<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function resolveCategoryName(categories: CategoryJoin, fallback = ''): string {
  const cat = unwrap(categories);
  const name = cat?.name?.trim();
  return name || fallback;
}

export function buildProductProfitRows(
  products: ProductSeed[],
  inventory: InventorySeed[],
  orderItems: OrderItemSeed[],
  dateFrom: string,
  dateTo: string,
): ProductProfitRow[] {
  const rows = new Map<string, ProductProfitRow>();

  const ensure = (
    key: string,
    seed: Omit<
      ProductProfitRow,
      'quantitySold' | 'revenue' | 'cost' | 'profit' | 'unitProfit' | 'marginPct'
    >,
  ) => {
    if (!rows.has(key)) {
      const unitProfit = seed.listPrice - seed.unitCost;
      rows.set(key, {
        ...seed,
        quantitySold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        unitProfit,
        marginPct: unitMarginPct(seed.listPrice, unitProfit),
      });
    }
    return rows.get(key)!;
  };

  for (const inv of inventory) {
    const forSale = isSaleInventoryItem(inv);
    const key = inv.product_id ? `p:${inv.product_id}` : `i:${inv.id}`;
    const categoryName = resolveCategoryName(inv.categories);
    const existing = rows.get(key);
    if (existing) {
      if (categoryName) existing.categoryName = categoryName;
      if (Number(inv.cost_per_unit) > 0) existing.unitCost = Number(inv.cost_per_unit);
      if (forSale && Number(inv.selling_price) > 0) {
        existing.listPrice = Number(inv.selling_price);
      }
      continue;
    }
    ensure(key, {
      key,
      id: inv.product_id ?? inv.id,
      name: inv.name,
      categoryName,
      unitCost: Number(inv.cost_per_unit),
      listPrice: forSale ? Number(inv.selling_price) : 0,
    });
  }

  for (const p of products) {
    const key = `p:${p.id}`;
    const categoryName = resolveCategoryName(p.categories);
    const existing = rows.get(key);
    if (existing) {
      if (categoryName) existing.categoryName = categoryName;
      if (Number(p.cost_price) > 0) existing.unitCost = Number(p.cost_price);
      if (Number(p.price) > 0) existing.listPrice = Number(p.price);
      continue;
    }
    ensure(key, {
      key,
      id: p.id,
      name: p.name,
      categoryName,
      unitCost: Number(p.cost_price),
      listPrice: Number(p.price),
    });
  }

  for (const item of orderItems) {
    const order = unwrap(item.orders);
    if (!order || order.status !== 'PAID') continue;
    if (!matchesDateRange(order.paid_at, dateFrom, dateTo)) continue;

    const pid = item.product_id;
    if (!pid) continue;

    const key = `p:${pid}`;
    const prod = unwrap(item.products);
    const categoryName = resolveCategoryName(prod?.categories);
    const existing = rows.get(key);
    const row = ensure(key, {
      key,
      id: pid,
      name: prod?.name ?? item.product_name,
      categoryName: categoryName || existing?.categoryName || '',
      unitCost: Number(prod?.cost_price ?? existing?.unitCost ?? 0),
      listPrice: Number(item.unit_price),
    });
    if (categoryName) row.categoryName = categoryName;

    const qty = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const unitCost = Number(prod?.cost_price ?? row.unitCost);

    row.quantitySold += qty;
    row.revenue += unitPrice * qty;
    row.cost += unitCost * qty;
    if (unitCost > 0) row.unitCost = unitCost;
  }

  const result = [...rows.values()].map((row) => {
    row.profit = row.revenue - row.cost;
    row.unitProfit = row.listPrice - row.unitCost;
    row.marginPct = row.revenue > 0 ? (row.profit / row.revenue) * 100 : unitMarginPct(row.listPrice, row.unitProfit);
    return row;
  });

  return result.sort((a, b) => {
    const profitA = displayProfit(a);
    const profitB = displayProfit(b);
    if (profitB !== profitA) return profitB - profitA;
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return a.name.localeCompare(b.name, 'ru');
  });
}

export function sumProductProfit(rows: ProductProfitRow[]) {
  return rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      profit: acc.profit + row.profit,
      quantitySold: acc.quantitySold + row.quantitySold,
    }),
    { revenue: 0, cost: 0, profit: 0, quantitySold: 0 },
  );
}
