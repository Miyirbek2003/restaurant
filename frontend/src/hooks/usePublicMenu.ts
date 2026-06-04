import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PublicMenuProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  products: PublicMenuProduct[];
};

export type PublicMenuData = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    currency: string;
    phone: string | null;
    address: string | null;
  };
  categories: PublicMenuCategory[];
};

export function usePublicMenu(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-menu', slug],
    enabled: Boolean(slug?.trim()),
    queryFn: async (): Promise<PublicMenuData | null> => {
      const { data, error } = await supabase.rpc('get_public_menu', { p_slug: slug!.trim() });
      if (error) throw error;
      if (!data) return null;
      return data as PublicMenuData;
    },
  });
}
