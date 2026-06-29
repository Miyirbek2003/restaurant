export type ProductSaleUnit = 'PIECE' | 'KG';

const WEIGHT_EPS = 0.001;

export function isWeightProduct(unit: ProductSaleUnit | undefined): boolean {
  return unit === 'KG';
}

/** Parse kg + grams fields into total kg (3 decimal places). */
export function parseWeightKg(kgPart: string, gramsPart: string): number | null {
  const kgRaw = kgPart.trim().replace(',', '.');
  const gRaw = gramsPart.trim();
  const kg = kgRaw === '' ? 0 : Number(kgRaw);
  const g = gRaw === '' ? 0 : Number.parseInt(gRaw, 10);
  if (!Number.isFinite(kg) || !Number.isFinite(g)) return null;
  if (kg < 0 || g < 0 || g >= 1000) return null;
  const total = Math.round((kg + g / 1000) * 1000) / 1000;
  if (total <= 0) return null;
  return total;
}

export function roundWeightKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function weightsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < WEIGHT_EPS;
}

export function isWeightZero(qty: number): boolean {
  return qty < WEIGHT_EPS;
}

/** Human-readable weight for UI (Russian). */
export function formatSaleQuantity(qty: number, unit: ProductSaleUnit): string {
  if (unit === 'PIECE') {
    return Number.isInteger(qty) ? String(qty) : String(qty);
  }
  const rounded = roundWeightKg(qty);
  const kg = Math.floor(rounded);
  const grams = Math.round((rounded - kg) * 1000);
  if (kg === 0) return `${grams} г`;
  if (grams === 0) return `${kg} кг`;
  return `${kg} кг ${grams} г`;
}

export function splitWeightKg(totalKg: number): { kg: string; grams: string } {
  const rounded = roundWeightKg(totalKg);
  const kg = Math.floor(rounded);
  const grams = Math.round((rounded - kg) * 1000);
  return { kg: kg > 0 ? String(kg) : '', grams: grams > 0 ? String(grams) : '' };
}
