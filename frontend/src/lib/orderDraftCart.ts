import { minLineQuantity } from '@/lib/orderEdit';
import {
  draftQtyByProduct,
  isUnsavedOrderLine,
  sortDraftLines,
  type DraftOrderLine,
} from '@/lib/orderItemSave';
import { isWeightZero, roundWeightKg, type ProductSaleUnit } from '@/lib/weight';

export type ComposerCartLine = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  sale_unit: ProductSaleUnit;
};

type ProductInfo = {
  name: string;
  price: number;
  sale_unit?: ProductSaleUnit;
};

export function draftToCart(
  draft: DraftOrderLine[],
  productsById: Map<string, ProductInfo>,
): ComposerCartLine[] {
  const byProduct = new Map<string, ComposerCartLine>();
  for (const line of draft) {
    const product = productsById.get(line.product_id);
    const saleUnit = product?.sale_unit ?? 'PIECE';
    const existing = byProduct.get(line.product_id);
    if (existing) {
      existing.quantity = roundWeightKg(existing.quantity + line.quantity);
      continue;
    }
    byProduct.set(line.product_id, {
      product_id: line.product_id,
      name: line.product_name || product?.name || '',
      price: line.unit_price,
      quantity: line.quantity,
      sale_unit: saleUnit,
    });
  }
  return [...byProduct.values()];
}

export function baselineQtyForProduct(baseline: DraftOrderLine[], productId: string): number {
  return draftQtyByProduct(baseline).get(productId) ?? 0;
}

export function canDecreaseCartQty(
  baseline: DraftOrderLine[],
  productId: string,
  currentQty: number,
  isManager: boolean,
): boolean {
  if (isManager) return currentQty > 0;
  const floor = baselineQtyForProduct(baseline, productId);
  return currentQty > floor + 0.0001;
}

export function applyCartQtyChange(
  draft: DraftOrderLine[],
  baseline: DraftOrderLine[],
  productId: string,
  targetQty: number,
  product: ProductInfo,
  isManager: boolean,
): DraftOrderLine[] {
  const roundedTarget = roundWeightKg(targetQty);
  const lines = draft.filter((l) => l.product_id === productId);
  const currentQty = roundWeightKg(lines.reduce((sum, l) => sum + l.quantity, 0));
  const baselineQty = baselineQtyForProduct(baseline, productId);

  if (!isManager && roundedTarget < baselineQty - 0.0001) {
    return draft;
  }

  if (isWeightZero(roundedTarget)) {
    if (!isManager && baselineQty > 0.0001) return draft;
    return draft
      .map((line) => {
        if (line.product_id !== productId) return line;
        const floor = minLineQuantity(line.kitchen_qty, isManager);
        if (floor > 0) return { ...line, quantity: floor };
        return null;
      })
      .filter((line): line is DraftOrderLine => line != null);
  }

  const delta = roundWeightKg(roundedTarget - currentQty);
  if (Math.abs(delta) < 0.0001) return draft;

  if (delta > 0) {
    const now = Date.now();
    return sortDraftLines([
      ...draft,
      {
        key: `new-${productId}-${now}`,
        product_id: productId,
        product_name: product.name,
        quantity: delta,
        kitchen_qty: 0,
        unit_price: Number(product.price),
        tax_rate: 10,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  if (delta < 0) {
    let toRemove = -delta;
    let next = [...draft];

    if (isManager) {
      const productLines = sortDraftLines(draft.filter((l) => l.product_id === productId)).reverse();

      for (const line of productLines) {
        if (toRemove <= 0.0001) break;
        const floor = minLineQuantity(line.kitchen_qty, true);
        const removable = Math.max(0, roundWeightKg(line.quantity - floor));
        const remove = Math.min(removable, toRemove);
        if (remove <= 0.0001) continue;

        toRemove = roundWeightKg(toRemove - remove);
        const nextQty = roundWeightKg(line.quantity - remove);
        if (isWeightZero(nextQty)) {
          next = next.filter((l) => l.key !== line.key);
        } else {
          next = next.map((l) => (l.key === line.key ? { ...l, quantity: nextQty } : l));
        }
      }

      return next;
    }

    const unsavedLines = sortDraftLines(
      draft.filter((l) => l.product_id === productId && isUnsavedOrderLine(l)),
    ).reverse();

    for (const line of unsavedLines) {
      if (toRemove <= 0.0001) break;
      const remove = Math.min(line.quantity, toRemove);
      toRemove = roundWeightKg(toRemove - remove);
      const nextQty = roundWeightKg(line.quantity - remove);
      if (isWeightZero(nextQty)) {
        next = next.filter((l) => l.key !== line.key);
      } else {
        next = next.map((l) => (l.key === line.key ? { ...l, quantity: nextQty } : l));
      }
    }

    return next;
  }

  return draft;
}
