import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-menu', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: restaurant, error: rErr } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, currency')
        .eq('slug', slug!)
        .eq('status', 'ACTIVE')
        .single();
      if (rErr) throw rErr;

      const { data: categories, error: cErr } = await supabase
        .from('categories')
        .select('id, name, products(id, name, description, price, image_url)')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('sort_order');
      if (cErr) throw cErr;

      return { restaurant, categories };
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Menu not found</p>
      </div>
    );
  }

  const { restaurant, categories } = data;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b bg-white px-6 py-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-bold">{restaurant.name}</h1>
        <p className="mt-2 text-slate-500">Digital Menu</p>
      </header>
      <main className="mx-auto max-w-2xl space-y-8 p-6">
        {categories?.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-4 text-xl font-semibold">{cat.name}</h2>
            <div className="space-y-3">
              {(cat.products as Array<{ id: string; name: string; description: string | null; price: number }>)
                ?.filter((p) => p)
                .map((product) => (
                  <div
                    key={product.id}
                    className="flex justify-between rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-slate-500">{product.description}</p>
                      )}
                    </div>
                    <p className="font-bold text-primary-600">
                      {formatCurrency(Number(product.price), restaurant.currency)}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
