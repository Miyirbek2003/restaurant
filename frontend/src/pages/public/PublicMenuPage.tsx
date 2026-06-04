import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Phone } from 'lucide-react';
import { MenuImage } from '@/components/ui/MenuImage';
import { resolveImageUrl } from '@/lib/images';
import { formatCurrency } from '@/lib/utils';
import { usePublicMenu, type PublicMenuCategory } from '@/hooks/usePublicMenu';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = usePublicMenu(slug);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f0f12]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0f0f12] px-6 text-center">
        <p className="text-lg font-semibold text-white">{t('qr.publicNotFound')}</p>
        <p className="max-w-xs text-sm text-white/50">{t('qr.publicNotFoundHint')}</p>
      </div>
    );
  }

  const { restaurant, categories } = data;
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#0f0f12] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.35),transparent)]" />

      <header className="relative px-5 pb-8 pt-10 text-center">
        {restaurant.logo_url ? (
          <MenuImage
            src={restaurant.logo_url}
            alt=""
            size="lg"
            className="mx-auto mb-5 h-20 w-20 rounded-2xl ring-2 ring-white/10 shadow-xl"
          />
        ) : (
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-2xl font-bold shadow-xl ring-2 ring-white/10">
            {restaurant.name.charAt(0)}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{restaurant.name}</h1>
        <p className="mt-1.5 text-sm font-medium uppercase tracking-widest text-white/40">
          {t('qr.publicSubtitle')}
        </p>
        {(restaurant.address || restaurant.phone) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
            {restaurant.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {restaurant.address}
              </span>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="inline-flex items-center gap-1 hover:text-white/80"
              >
                <Phone className="h-3.5 w-3.5" />
                {restaurant.phone}
              </a>
            )}
          </div>
        )}
      </header>

      <main className="relative mx-auto max-w-lg px-4 pb-10">
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
            {t('qr.publicEmpty')}
          </p>
        ) : selectedCategory ? (
          <CategoryProductsView
            category={selectedCategory}
            currency={restaurant.currency}
            onBack={() => setSelectedCategoryId(null)}
          />
        ) : (
          <CategoryListView categories={categories} onSelect={setSelectedCategoryId} />
        )}
      </main>
    </div>
  );
}

function CategoryListView({
  categories,
  onSelect,
}: {
  categories: PublicMenuCategory[];
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-5 text-center text-sm text-white/45">{t('qr.pickCategory')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl bg-white/5 text-left ring-1 ring-white/10 transition',
              'hover:bg-white/10 hover:ring-white/20 active:scale-[0.98]',
              i === 0 && categories.length % 2 === 1 && 'sm:col-span-2',
            )}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <img
                src={resolveImageUrl(cat.image_url)}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = resolveImageUrl(null);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f12] via-[#0f0f12]/40 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-4">
              <div>
                <p className="text-lg font-semibold leading-tight">{cat.name}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  {t('qr.itemCount', { n: cat.products.length })}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition group-hover:bg-primary-500">
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryProductsView({
  category,
  currency,
  onBack,
}: {
  category: PublicMenuCategory;
  currency: string;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-3 bg-[#0f0f12]/90 px-4 py-3 backdrop-blur-lg">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15 active:scale-95"
          aria-label={t('common.back')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{category.name}</p>
          <p className="text-xs text-white/45">{t('qr.itemCount', { n: category.products.length })}</p>
        </div>
        {category.image_url && (
          <MenuImage src={category.image_url} alt="" size="sm" className="h-10 w-10 rounded-xl ring-1 ring-white/10" />
        )}
      </div>

      <div className="space-y-3">
        {category.products.map((product) => (
          <article
            key={product.id}
            className="flex gap-4 overflow-hidden rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
          >
            <MenuImage
              src={product.image_url}
              alt={product.name}
              size="lg"
              className="!h-24 !w-24 shrink-0 rounded-xl ring-1 ring-white/10"
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
              <h3 className="font-semibold leading-snug">{product.name}</h3>
              {product.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/45">
                  {product.description}
                </p>
              )}
              <p className="mt-2 text-lg font-bold tabular-nums text-primary-400">
                {formatCurrency(Number(product.price), currency)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
