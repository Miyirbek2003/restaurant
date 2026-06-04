import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, ExternalLink, Download, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { useQrMenuSettings, useUpdateQrMenuEnabled } from '@/hooks/useQrMenuSettings';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

export function QrMenuPage() {
  const { profile } = useAuth();
  const restaurant = profile?.restaurants as {
    slug: string;
    name: string;
    status?: string;
  } | null;

  const { data: settings, isLoading: settingsLoading } = useQrMenuSettings();
  const updateEnabled = useUpdateQrMenuEnabled();
  const notify = useNotificationStore((s) => s.add);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const menuUrl = restaurant ? `${window.location.origin}/menu/${restaurant.slug}` : '';
  const enabled = settings?.enabled ?? true;

  useEffect(() => {
    if (!menuUrl) return;
    QRCode.toDataURL(menuUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [menuUrl]);

  if (!profile?.restaurant_id || !restaurant) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('qr.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (settingsLoading) return <Spinner />;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      notify({ type: 'success', title: t('qr.linkCopied') });
    } catch {
      notify({ type: 'error', title: t('qr.copyFailed') });
    }
  };

  const toggleEnabled = (next: boolean) => {
    updateEnabled.mutate(next, {
      onSuccess: () =>
        notify({
          type: 'success',
          title: next ? t('qr.enabledSuccess') : t('qr.disabledSuccess'),
        }),
      onError: (err) =>
        notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
    });
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
          <QrCode className="h-6 w-6" />
        </div>
        <div>
          <h2 className="page-title">{t('qr.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('qr.subtitle')}</p>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="font-medium">{t('qr.enabledLabel')}</p>
            <p className="text-sm text-slate-500">{t('qr.enabledHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={updateEnabled.isPending}
            onClick={() => toggleEnabled(!enabled)}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                enabled && 'translate-x-5',
              )}
            />
          </button>
        </div>

        <div className={cn('flex flex-col items-center px-6 py-8 text-center', !enabled && 'opacity-50')}>
          <p className="mb-6 max-w-xs text-sm text-slate-500">{t('qr.scanHint', { name: restaurant.name })}</p>
          <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200/80 dark:ring-slate-700">
            {qrUrl ? (
              <img src={qrUrl} alt={t('qr.alt')} className="h-[280px] w-[280px]" />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
          <p className="mt-5 max-w-full break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-primary-600 dark:bg-slate-800/80 dark:text-primary-400">
            {menuUrl}
          </p>

          <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button size="sm" variant="secondary" className="w-full" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4" />
              {t('qr.copyLink')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={!enabled}
              onClick={() => window.open(menuUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              {t('qr.openMenu')}
            </Button>
            {qrUrl && (
              <a href={qrUrl} download={`${restaurant.slug}-qr-menu.png`} className="w-full">
                <Button size="sm" variant="secondary" className="w-full" type="button">
                  <Download className="h-4 w-4" />
                  {t('qr.downloadQr')}
                </Button>
              </a>
            )}
          </div>

          {!enabled && (
            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              {t('qr.disabledNotice')}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
