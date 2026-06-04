import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRestaurantId } from '@/contexts/AuthContext';

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

export function useCustomersList(enabled = true) {
  const restaurantId = useRestaurantId();

  return useQuery({
    queryKey: ['customers', restaurantId],
    enabled: Boolean(restaurantId) && enabled,
    retry: 1,
    queryFn: async (): Promise<CustomerOption[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('restaurant_id', restaurantId!)
        .order('name');

      if (error) throw error;
      return (data ?? []) as CustomerOption[];
    },
  });
}
