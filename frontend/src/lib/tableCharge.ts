import {
  computeTableCharge,
  type TableChargeType,
} from '@/lib/orderBilling';

export type TableChargeFields = {
  charge_type?: TableChargeType | string | null;
  charge_amount?: number | null;
};

export function tableHasCharge(table: TableChargeFields | null | undefined): boolean {
  return table?.charge_type === 'HOURLY' || table?.charge_type === 'ONE_TIME';
}

export function resolveTableChargeAmount(
  table: TableChargeFields | null | undefined,
  hours = 1,
): number {
  if (!table) return 0;
  return computeTableCharge(table.charge_type, Number(table.charge_amount ?? 0), hours);
}
