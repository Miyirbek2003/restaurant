import { ru, type RuTree } from './ru';

type Leaf = string | Record<string, unknown>;

function getPath(tree: Leaf, path: string): string | undefined {
  const parts = path.split('.');
  let cur: Leaf = tree;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null || !(p in cur)) return undefined;
    cur = cur[p] as Leaf;
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Translate key with optional `{name}` placeholders */
export function t(path: string, vars?: Record<string, string | number>): string {
  let s = getPath(ru as unknown as Leaf, path) ?? path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function orderStatus(status: string): string {
  return getPath(ru.orderStatus as unknown as Leaf, status) ?? status;
}

export function tableStatus(status: string): string {
  return getPath(ru.tableStatus as unknown as Leaf, status) ?? status;
}

export function bookingStatus(status: string): string {
  return getPath(ru.bookingStatus as unknown as Leaf, status) ?? status;
}

export function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return getPath(ru.roles as unknown as Leaf, role) ?? role.replace('_', ' ');
}

export function inventoryUnit(unit: string): string {
  return getPath(ru.units as unknown as Leaf, unit) ?? unit;
}

export function expenseCategory(cat: string): string {
  return getPath(ru.expenses.cat as unknown as Leaf, cat) ?? cat;
}

export function inventoryItemType(type: string): string {
  if (type === 'KITCHEN') return t('warehouse.typeKitchen');
  if (type === 'SALE') return t('warehouse.typeSale');
  return type;
}

export function discountType(type: string): string {
  return getPath(ru.discounts.types as unknown as Leaf, type) ?? type;
}

export { ru };
export type { RuTree };
