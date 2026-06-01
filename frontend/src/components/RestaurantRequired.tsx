import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { t, roleLabel } from '@/i18n';

export function RestaurantRequired() {
  const { profile, refreshProfile } = useAuth();

  return (
    <Card className="max-w-lg space-y-3 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">{t('restaurantRequired.title')}</h2>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        {t('restaurantRequired.body', {
          email: profile?.email ?? '',
          role: roleLabel(profile?.role),
        })}
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        В Supabase SQL Editor выполните:
        <pre className="mt-2 overflow-x-auto rounded bg-white/60 p-2 text-xs dark:bg-black/30">
{`UPDATE profiles
SET restaurant_id = 'a0000000-0000-4000-8000-000000000001',
    role = 'MANAGER'
WHERE email = '${profile?.email ?? 'your@email.com'}';`}
        </pre>
      </p>
      <Button size="sm" variant="secondary" onClick={() => refreshProfile()}>
        {t('common.refreshProfile')}
      </Button>
    </Card>
  );
}
