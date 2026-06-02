import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useCloseCashRegister,
  useOpenOrdersCount,
  useSessionPaymentTotals,
  type CashRegisterSession,
} from '@/hooks/useCashRegister';
import { formatCurrency } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

type CloseCashRegisterModalProps = {
  open: boolean;
  onClose: () => void;
  session: CashRegisterSession;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function CloseCashRegisterModal({
  open,
  onClose,
  session,
  onSuccess,
  onError,
}: CloseCashRegisterModalProps) {
  const { data: expected, isLoading } = useSessionPaymentTotals(session.id, session.opened_at);
  const { data: openOrdersCount = 0 } = useOpenOrdersCount();
  const closeRegister = useCloseCashRegister();

  const [countedCash, setCountedCash] = useState('');
  const [countedCard, setCountedCard] = useState('');
  const [countedClick, setCountedClick] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  useEffect(() => {
    if (!open || !expected) return;
    setCountedCash(String(expected.cash));
    setCountedCard(String(expected.card + expected.mobile));
    setCountedClick(String(expected.click));
    setClosingNotes('');
  }, [open, expected]);

  const handleClose = () => {
    if (!expected) return;
    closeRegister.mutate(
      {
        sessionId: session.id,
        expected,
        countedCash: parseFloat(countedCash) || 0,
        countedCard: parseFloat(countedCard) || 0,
        countedClick: parseFloat(countedClick) || 0,
        closingNotes,
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
        onError: (err) => onError(getErrorMessage(err)),
      },
    );
  };

  const factCash = parseFloat(countedCash) || 0;
  const factCard = parseFloat(countedCard) || 0;
  const factClick = parseFloat(countedClick) || 0;
  const expectedTotal = expected?.total ?? 0;
  const factTotal = factCash + factCard + factClick;
  const diff = factTotal - expectedTotal;
  const shortage = diff < 0 ? Math.abs(diff) : 0;
  const excess = diff > 0 ? diff : 0;

  return (
    <Modal open={open} onClose={onClose} title={t('kassa.closeTitle')}>
      <div className="space-y-4">
        {openOrdersCount > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {t('cashRegister.openOrdersWarning', { n: openOrdersCount })}
          </div>
        )}

        {isLoading || !expected ? (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        ) : (
          <>
            <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-medium text-slate-700 dark:text-slate-200">{t('kassa.expectedFromSystem')}</p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t('cashRegister.cash')}</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(expected.cash)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t('cashRegister.card')}</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(expected.card + expected.mobile)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t('cashRegister.click')}</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(expected.click)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>{t('cashRegister.total')}</dt>
                <dd className="tabular-nums text-emerald-600">{formatCurrency(expected.total)}</dd>
              </div>
              <p className="text-xs text-slate-500">{t('kassa.paymentsCount', { n: expected.count })}</p>
            </dl>

            <p className="text-sm font-medium">{t('kassa.countedInDrawer')}</p>
            <Input
              label={t('cashRegister.cash')}
              type="number"
              min="0"
              step="0.01"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
            />
            <Input
              label={t('cashRegister.card')}
              type="number"
              min="0"
              step="0.01"
              value={countedCard}
              onChange={(e) => setCountedCard(e.target.value)}
              disabled
            />
            <Input
              label={t('cashRegister.click')}
              type="number"
              min="0"
              step="0.01"
              value={countedClick}
              onChange={(e) => setCountedClick(e.target.value)}
              disabled
            />
            <Input
              label={t('kassa.closingNotes')}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder={t('kassa.closingNotesPlaceholder')}
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-medium">{t('kassa.factSectionTitle')}</p>
              <p className="text-slate-500">{t('kassa.countedShort', { cash: formatCurrency(factCash), card: formatCurrency(factCard), click: formatCurrency(factClick) })}</p>
              <div className="mt-1 flex justify-between font-semibold">
                <span>{t('kassa.factTotal')}</span>
                <span className="tabular-nums">{formatCurrency(factTotal)}</span>
              </div>
              {shortage > 0 && (
                <div className="mt-1 flex justify-between text-red-600 dark:text-red-400">
                  <span>{t('kassa.shortage')}</span>
                  <span className="tabular-nums">{formatCurrency(shortage)}</span>
                </div>
              )}
              {excess > 0 && (
                <div className="mt-1 flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>{t('kassa.excess')}</span>
                  <span className="tabular-nums">{formatCurrency(excess)}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={closeRegister.isPending} disabled={!expected || closeRegister.isPending} onClick={handleClose}>
            {t('kassa.closeConfirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
