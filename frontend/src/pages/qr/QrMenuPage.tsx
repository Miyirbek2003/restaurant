import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { t } from '@/i18n';

export function QrMenuPage() {
  const { profile } = useAuth();
  const restaurant = profile?.restaurants as { slug: string; name: string } | null;
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const menuUrl = restaurant ? `${window.location.origin}/menu/${restaurant.slug}` : '';

  useEffect(() => {
    if (!menuUrl) return;
    QRCode.toDataURL(menuUrl, { width: 320, margin: 2 }).then(setQrUrl);
  }, [menuUrl]);

  if (!restaurant) return <Spinner />;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h2 className="text-2xl font-bold">{t('qr.title')}</h2>
      <Card className="flex flex-col items-center text-center">
        <p className="mb-4 text-slate-500">{t('qr.scanHint', { name: restaurant.name })}</p>
        {qrUrl ? (
          <img src={qrUrl} alt={t('qr.alt')} className="rounded-lg" />
        ) : (
          <Spinner />
        )}
        <p className="mt-4 break-all text-sm text-primary-600">{menuUrl}</p>
      </Card>
    </div>
  );
}
