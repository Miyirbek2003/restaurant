import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ImageUrlField } from '@/components/ui/ImageUrlField';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { useAuth } from '@/contexts/AuthContext';
import { useMyRestaurant, useUpdateRestaurantLogo } from '@/hooks/useMyRestaurant';
import { useRestaurantSettings, useUpdateRestaurantSettings } from '@/hooks/useRestaurantSettings';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const notify = useNotificationStore((s) => s.add);

  const { data: restaurant, isLoading: restaurantLoading } = useMyRestaurant();
  const updateLogo = useUpdateRestaurantLogo();

  const { data: chargeSettings, isLoading: chargeLoading } = useRestaurantSettings();
  const updateCharge = useUpdateRestaurantSettings();

  const [logoUrl, setLogoUrl] = useState('');
  const [logoDirty, setLogoDirty] = useState(false);
  const [percent, setPercent] = useState('10');
  const [percentDirty, setPercentDirty] = useState(false);

  useEffect(() => {
    if (restaurant == null || logoDirty) return;
    setLogoUrl(restaurant.logo_url ?? '');
  }, [restaurant, logoDirty]);

  useEffect(() => {
    if (chargeSettings == null || percentDirty) return;
    setPercent(String(chargeSettings.percent));
  }, [chargeSettings, percentDirty]);

  if (!profile?.restaurant_id) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('settings.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (restaurantLoading || chargeLoading) return <Spinner />;

  const parsedPercent = parseFloat(percent);
  const showZeroInfo = !Number.isNaN(parsedPercent) && parsedPercent === 0;

  const saveLogo = async () => {
    try {
      await updateLogo.mutateAsync(logoUrl.trim() || null);
      setLogoDirty(false);
      await refreshProfile();
      notify({ type: 'success', title: t('settings.logoSaved') });
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const saveServiceFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(percent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      notify({ type: 'error', title: t('settings.serviceFeeInvalid') });
      return;
    }
    try {
      await updateCharge.mutateAsync(value);
      setPercentDirty(false);
      notify({ type: 'success', title: t('settings.serviceFeeSaved') });
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="page-title">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold">{t('settings.logoTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('settings.logoHint')}</p>
        </div>
        <ImageUrlField
          label={t('settings.logoLabel')}
          value={logoUrl}
          onChange={(url) => {
            setLogoUrl(url);
            setLogoDirty(true);
          }}
          previewAlt={restaurant?.name ?? t('settings.logoLabel')}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            loading={updateLogo.isPending}
            disabled={!logoDirty}
            onClick={() => void saveLogo()}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold">{t('settings.serviceFeeTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('settings.serviceFeeHint')}</p>
        </div>
        <form onSubmit={(e) => void saveServiceFee(e)} className="space-y-4">
          <Input
            label={t('settings.serviceFeePercent')}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value);
              setPercentDirty(true);
            }}
            required
          />
          {showZeroInfo && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {t('settings.serviceFeeZeroHint')}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={updateCharge.isPending} disabled={!percentDirty}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
