import type { StockFailure } from '@/lib/stock';

export type DraftOrderLine = {
  key: string;
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  kitchen_qty: number;
  unit_price: number;
  tax_rate: number;
  created_at?: string | null;
};

export type ServerOrderLine = {
  id: string;
  product_id: string | null;
  product_name?: string | null;
  quantity: number;
  kitchen_qty?: number;
  unit_price: number;
  tax_rate: number;
  created_at?: string | null;
  products?: { name: string } | null;
};

/** Stable kitchen order: when the line was added to the order. */
export function lineSortTime(line: DraftOrderLine): number {
  if (line.created_at) return new Date(line.created_at).getTime();
  const m = /^new-[^-]+-(\d+)$/.exec(line.key);
  if (m) return Number(m[1]);
  return 0;
}

export function sortDraftLines(lines: DraftOrderLine[]): DraftOrderLine[] {
  return [...lines].sort((a, b) => lineSortTime(a) - lineSortTime(b));
}

export function sortOrderItemsByCreated<T extends { created_at?: string | null }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
}

export type DraftDisplayUnit = {
  line: DraftOrderLine;
  unitIndex: number;
  isLastUnit: boolean;
};

/** One UI row per unit (no combined "2×" rows). */
export function expandDraftForDisplay(lines: DraftOrderLine[]): DraftDisplayUnit[] {
  const rows: DraftDisplayUnit[] = [];
  for (const line of sortDraftLines(lines)) {
    const count = Math.max(1, line.quantity);
    for (let unitIndex = 0; unitIndex < count; unitIndex++) {
      rows.push({ line, unitIndex, isLastUnit: unitIndex === count - 1 });
    }
  }
  return rows;
}

export function serverLinesToDraft(items: ServerOrderLine[]): DraftOrderLine[] {
  return sortDraftLines(
    items
      .filter((i) => i.product_id)
      .map((i) => ({
        key: i.id,
        id: i.id,
        product_id: i.product_id!,
        product_name: i.product_name?.trim() || i.products?.name || '',
        quantity: i.quantity,
        kitchen_qty: i.kitchen_qty ?? 0,
        unit_price: Number(i.unit_price),
        tax_rate: Number(i.tax_rate),
        created_at: i.created_at ?? null,
      })),
  );
}

export function draftQtyByProduct(draft: DraftOrderLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of draft) {
    m.set(line.product_id, (m.get(line.product_id) ?? 0) + line.quantity);
  }
  return m;
}

export function isDraftDirty(original: DraftOrderLine[], draft: DraftOrderLine[]): boolean {
  if (original.length !== draft.length) return true;
  const norm = (lines: DraftOrderLine[]) =>
    [...lines]
      .map((l) => `${l.id ?? 'n'}:${l.product_id}:${l.quantity}`)
      .sort()
      .join('|');
  return norm(original) !== norm(draft);
}

export type OrderItemSaveOp =
  | { type: 'delete'; itemId: string; productId: string; quantity: number }
  | { type: 'update'; itemId: string; productId: string; fromQty: number; toQty: number }
  | { type: 'insert'; productId: string; quantity: number; unit_price: number; tax_rate: number; product_name: string };

export function buildOrderItemSaveOps(
  original: DraftOrderLine[],
  draft: DraftOrderLine[],
): OrderItemSaveOp[] {
  const ops: OrderItemSaveOp[] = [];
  const origById = new Map(original.map((l) => [l.key, l]));
  const draftById = new Map(draft.map((l) => [l.key, l]));

  for (const o of original) {
    const d = draftById.get(o.key);
    if (!d) {
      ops.push({ type: 'delete', itemId: o.id!, productId: o.product_id, quantity: o.quantity });
      continue;
    }
    if (d.quantity !== o.quantity) {
      ops.push({
        type: 'update',
        itemId: o.id!,
        productId: o.product_id,
        fromQty: o.quantity,
        toQty: d.quantity,
      });
    }
  }

  for (const d of draft) {
    if (!d.id || !origById.has(d.key)) {
      ops.push({
        type: 'insert',
        productId: d.product_id,
        quantity: d.quantity,
        unit_price: d.unit_price,
        tax_rate: d.tax_rate,
        product_name: d.product_name,
      });
    }
  }

  return ops;
}

/** Net stock change per product (positive = need more stock). */
export function stockDeltasFromOps(
  ops: OrderItemSaveOp[],
): { product_id: string; delta: number }[] {
  const m = new Map<string, number>();
  const add = (pid: string, d: number) => m.set(pid, (m.get(pid) ?? 0) + d);

  for (const op of ops) {
    if (op.type === 'delete') add(op.productId, -op.quantity);
    else if (op.type === 'update') add(op.productId, op.toQty - op.fromQty);
    else if (op.type === 'insert') add(op.productId, op.quantity);
  }

  return [...m.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([product_id, delta]) => ({ product_id, delta }));
}

export function stockFailureError(failures: StockFailure[]): Error & { stockFailures?: StockFailure[] } {
  const err = new Error('INSUFFICIENT_STOCK') as Error & { stockFailures?: StockFailure[] };
  err.stockFailures = failures;
  return err;
}

/** Waiters may only append new lines; existing lines must stay unchanged. */
export function validateOrderItemEditsForWaiter(
  original: DraftOrderLine[],
  draft: DraftOrderLine[],
): boolean {
  const draftByKey = new Map(draft.map((l) => [l.key, l]));

  for (const line of original) {
    const next = draftByKey.get(line.key);
    if (!next) return false;
    if (next.quantity !== line.quantity) return false;
  }

  return true;
}

export function isUnsavedOrderLine(line: DraftOrderLine): boolean {
  return !line.id;
}
