import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

type MenuImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

const sizes = {
  xs: 'h-8 w-8',
  sm: 'h-9 w-9',
  md: 'h-14 w-14',
  lg: 'h-24 w-24',
};

export function MenuImage({ src, alt, className, size = 'md' }: MenuImageProps) {
  return (
    <img
      src={resolveImageUrl(src)}
      alt={alt}
      className={cn('shrink-0 rounded-lg object-cover bg-slate-100 dark:bg-slate-800', sizes[size], className)}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src.includes('placeholder-food')) return;
        img.src = resolveImageUrl(null);
      }}
    />
  );
}
