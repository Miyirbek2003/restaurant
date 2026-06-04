import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';
import {
  DEFAULT_SERVICE_FEE_RATE,
  serviceChargePercentFromSettings,
  serviceChargeRateFromSettings,
} from '@/lib/orderBilling';

export type ServiceChargeSettings = {
  rate: number;
  percent: number;
  isZero: boolean;
};

export function useRestaurantSettings() {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['restaurant-settings', restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async (): Promise<ServiceChargeSettings> => {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('service_charge_rate')
        .eq('restaurant_id', restaurantId!)
        .maybeSingle();

      if (error) throw error;

      const settingsExist = data != null;
      const percent = serviceChargePercentFromSettings(data?.service_charge_rate, settingsExist);
      const rate = serviceChargeRateFromSettings(data?.service_charge_rate, settingsExist);

      return {
        rate,
        percent,
        isZero: settingsExist && percent === 0,
      };
    },
  });
}

export function useServiceChargeSettings() {
  const query = useRestaurantSettings();
  return {
    ...query,
    data: query.data,
  };
}

/** Decimal rate (0–1) for billing. */
export function useServiceChargeRate() {
  const query = useServiceChargeSettings();
  return {
    ...query,
    data: query.data?.rate ?? (query.isLoading ? undefined : DEFAULT_SERVICE_FEE_RATE),
  };
}

export function useUpdateRestaurantSettings() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (serviceChargePercent: number) => {
      if (!restaurantId) throw new Error('No restaurant assigned');

      const clamped = Math.min(100, Math.max(0, Math.round(serviceChargePercent * 100) / 100));

      const { data: existing, error: readErr } = await supabase
        .from('restaurant_settings')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (readErr) throw readErr;

      if (existing?.id) {
        const { error } = await supabase
          .from('restaurant_settings')
          .update({ service_charge_rate: clamped })
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('restaurant_settings').insert({
          restaurant_id: restaurantId,
          service_charge_rate: clamped,
        });
        if (error) throw error;
      }

      return {
        rate: clamped / 100,
        percent: clamped,
        isZero: clamped === 0,
      } satisfies ServiceChargeSettings;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant-settings'] });
      void qc.invalidateQueries({ queryKey: ['restaurant-service-charge'] });
    },
  });
}
