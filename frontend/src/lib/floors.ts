export const DEFAULT_FLOORS = ['Hall', 'Outdoor'] as const;

export const FLOOR_FILTER_ALL = 'ALL' as const;

export type FloorFilter = typeof FLOOR_FILTER_ALL | string;

export function floorLabel(floor: string | null | undefined): string {
  if (!floor) return '—';
  return floor;
}

export function mergeFloors(configured: string[], tableFloors: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const f of configured) set.add(f);
  for (const f of tableFloors) {
    if (f?.trim()) set.add(f.trim());
  }
  return [...set];
}
