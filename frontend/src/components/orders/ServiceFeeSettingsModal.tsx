import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRestaurantSettings, useUpdateRestaurantSettings } from '@/hooks/useRestaurantSettings';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

type ServiceFeeSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ServiceFeeSettingsModal({ open, onClose }: ServiceFeeSettingsModalProps) {
  const { data: settings, isLoading } = useRestaurantSettings();
  const updateSettings = useUpdateRestaurantSettings();
  const notify = useNotificationStore((s) => s.add);
  const [percent, setPercent] = useState('10');

  useEffect(() => {
    if (!open || isLoading || settings == null) return;
    setPercent(String(settings.percent));
  }, [open, isLoading, settings]);

  const parsed = parseFloat(percent);
  const showZeroInfo = !Number.isNaN(parsed) && parsed === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(percent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      notify({ type: 'error', title: t('orders.serviceFeeInvalid') });
      return;
    }
    try {
      await updateSettings.mutateAsync(value);
      notify({ type: 'success', title: t('orders.serviceFeeSaved') });
      onClose();
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('orders.serviceFeeSettingsTitle')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label={t('orders.serviceFeePercent')}
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          required
        />
        <p className="text-sm text-slate-500">{t('orders.serviceFeeHint')}</p>
        {showZeroInfo && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {t('orders.serviceFeeZeroHint')}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={updateSettings.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
