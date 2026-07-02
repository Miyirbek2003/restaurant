import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { CloseCashRegisterModal } from '@/components/kassa/CloseCashRegisterModal';
import { KassaFactBreakdown } from '@/components/kassa/KassaFactBreakdown';
import { SessionSoldItems } from '@/components/kassa/SessionSoldItems';
import { SessionKassaExpenses } from '@/components/kassa/SessionKassaExpenses';
import {
  useOpenCashRegisterSession,
  useCashRegisterSessions,
  useSessionPaymentTotals,
  useCashiers,
  useOpenCashRegister,
} from '@/hooks/useCashRegister';
import { useMyStaffId } from '@/hooks/useMyStaff';
import { useAuth, useRestaurantId } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { formatCurrency } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import {
  lastDaysRange,
  matchesDateRange,
  todayRange,
  yesterdayRange,
} from '@/lib/filters';
import { t } from '@/i18n';

export function KassaPage() {
  const pageSize = 8;
  const { profile } = useAuth();
  const restaurantId = useRestaurantId();
  const notify = useNotificationStore((s) => s.add);
  const { data: openSession, isLoading: loadingOpen } = useOpenCashRegisterSession();
  const { data: myStaffId } = useMyStaffId();
  const { data: sessions = [], isLoading: loadingHistory } = useCashRegisterSessions();
  const { data: cashiers = [], isLoading: loadingCashiers } = useCashiers();
  const { data: liveTotals } = useSessionPaymentTotals(openSession?.id, openSession?.opened_at);
  const openKassa = useOpenCashRegister();

  const [cashierStaffId, setCashierStaffId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [historyVisibleCount, setHistoryVisibleCount] = useState(pageSize);
  const [historyCashierId, setHistoryCashierId] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState(() => todayRange().from);
  const [historyDateTo, setHistoryDateTo] = useState(() => todayRange().to);

  const historyCashierOptions = useMemo(
    () => [
      { value: '', label: t('kassa.allCashiers') },
      ...cashiers.map((c) => ({ value: c.id, label: c.name })),
    ],
    [cashiers],
  );

  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (historyCashierId && s.opened_by_staff_id !== historyCashierId) return false;
        return matchesDateRange(s.opened_at, historyDateFrom, historyDateTo);
      }),
    [sessions, historyCashierId, historyDateFrom, historyDateTo],
  );

  const pagedSessions = useMemo(
    () => filteredSessions.slice(0, historyVisibleCount),
    [filteredSessions, historyVisibleCount],
  );

  const applyHistoryRange = (range: { from: string; to: string }) => {
    setHistoryDateFrom(range.from);
    setHistoryDateTo(range.to);
  };

  const resetHistoryFilters = () => {
    const range = todayRange();
    setHistoryCashierId('');
    setHistoryDateFrom(range.from);
    setHistoryDateTo(range.to);
  };

  useEffect(() => {
    setHistoryVisibleCount(pageSize);
  }, [historyCashierId, historyDateFrom, historyDateTo, filteredSessions.length]);

  if (!restaurantId) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('kassa.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  if (loadingOpen || loadingCashiers) return <Spinner />;

  const isSessionOwner = Boolean(
    openSession &&
      ((openSession.opened_by_profile_id && openSession.opened_by_profile_id === profile?.id) ||
        (openSession.opened_by_staff_id && myStaffId && openSession.opened_by_staff_id === myStaffId)),
  );

  const cashierOptions = cashiers.map((c) => ({ value: c.id, label: c.name }));

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierStaffId) {
      notify({ type: 'warning', title: t('kassa.selectCashier') });
      return;
    }
    try {
      await openKassa.mutateAsync({
        openedByStaffId: cashierStaffId,
        openingFloat: parseFloat(openingFloat) || 0,
        openingNotes: openingNotes || undefined,
      });
      notify({ type: 'success', title: t('kassa.openedSuccess') });
      setOpeningNotes('');
    } catch (err) {
      notify({ type: 'error', title: t('kassa.openFailed'), message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('kassa.title')}</h2>
        <p className="text-sm text-slate-500">{t('kassa.subtitle')}</p>
      </div>

      {!openSession ? (
        <Card className="max-w-lg space-y-4 p-6">
          <h3 className="text-lg font-semibold">{t('kassa.closedState')}</h3>
          <p className="text-sm text-slate-500">{t('kassa.openPrompt')}</p>
          {cashierOptions.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('kassa.noCashiers')}{' '}
              <Link to="/employees" className="font-medium text-primary-600 underline">
                {t('kassa.addCashierLink')}
              </Link>
            </p>
          ) : (
            <form onSubmit={handleOpen} className="space-y-4">
              <Select
                label={t('kassa.whoOpens')}
                value={cashierStaffId}
                onChange={(e) => setCashierStaffId(e.target.value)}
                options={[{ value: '', label: t('kassa.chooseCashier') }, ...cashierOptions]}
                required
              />
              <Input
                label={t('kassa.openingFloat')}
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
              <Input
                label={t('kassa.openingNotes')}
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder={t('kassa.openingNotesPlaceholder')}
              />
              <Button type="submit" loading={openKassa.isPending} className="w-full sm:w-auto">
                {t('kassa.openButton')}
              </Button>
            </form>
          )}
        </Card>
      ) : (
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('kassa.openState')}</p>
              <p className="mt-1 text-lg font-bold">
                {openSession.opened_by_staff?.name ?? t('kassa.unknownCashier')}
              </p>
              <p className="text-sm text-slate-500">
                {t('kassa.openedAt', { time: format(new Date(openSession.opened_at), 'PPp') })}
              </p>
              <p className="text-sm text-slate-500">
                {t('kassa.openingFloatLabel', { amount: formatCurrency(Number(openSession.opening_float)) })}
              </p>
            </div>
            <Button variant="secondary" disabled={!isSessionOwner} onClick={() => setCloseModalOpen(true)}>
              {t('kassa.closeButton')}
            </Button>
          </div>
          {!isSessionOwner && <p className="text-sm text-amber-600">{t('kassa.openedByAnotherCashier')}</p>}

          {liveTotals && (
            <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <dt className="text-slate-500">{t('cashRegister.cash')}</dt>
                <dd className="text-lg font-bold tabular-nums">{formatCurrency(liveTotals.cash)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('cashRegister.card')}</dt>
                <dd className="text-lg font-bold tabular-nums">
                  {formatCurrency(liveTotals.card + liveTotals.mobile)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('cashRegister.click')}</dt>
                <dd className="text-lg font-bold tabular-nums">{formatCurrency(liveTotals.click)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('cashRegister.total')}</dt>
                <dd className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(liveTotals.total)}</dd>
              </div>
            </dl>
          )}

          <Link to="/orders" className="inline-block text-sm font-medium text-primary-600 hover:underline">
            {t('kassa.goToOrders')}
          </Link>
        </Card>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{t('kassa.history')}</h3>
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full min-w-[12rem] sm:w-auto sm:min-w-[14rem]">
            <Select
              label={t('kassa.historyCashier')}
              value={historyCashierId}
              onChange={(e) => setHistoryCashierId(e.target.value)}
              options={historyCashierOptions}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[9.5rem]">
              <Input
                label={t('filters.dateFrom')}
                type="date"
                value={historyDateFrom}
                max={historyDateTo || undefined}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
              />
            </div>
            <div className="w-[9.5rem]">
              <Input
                label={t('filters.dateTo')}
                type="date"
                value={historyDateTo}
                min={historyDateFrom || undefined}
                onChange={(e) => setHistoryDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => applyHistoryRange(todayRange())}>
              {t('filters.today')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyHistoryRange(yesterdayRange())}>
              {t('filters.yesterday')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyHistoryRange(lastDaysRange(7))}>
              {t('filters.last7Days')}
            </Button>
          </div>
          <div className="flex w-full shrink-0 items-end sm:ml-auto sm:w-auto">
            <Button type="button" size="sm" variant="ghost" onClick={resetHistoryFilters}>
              {t('filters.reset')}
            </Button>
          </div>
        </div>
        {loadingHistory ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('kassa.noHistory')}</p>
        ) : filteredSessions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('kassa.noHistoryFiltered')}</p>
        ) : (
          <div className="space-y-2">
            {pagedSessions.map((s) => {
              const expectedTotal =
                Number(s.expected_cash) + Number(s.expected_card) + Number(s.expected_click);
              const factTotal =
                Number(s.counted_cash ?? 0) + Number(s.counted_card ?? 0) + Number(s.counted_click ?? 0);
              const shortage = s.status === 'CLOSED' ? expectedTotal - factTotal : 0;

              return (
                <Card key={s.id} className="space-y-3 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {s.opened_by_staff?.name ?? '—'} ·{' '}
                        <span className={s.status === 'OPEN' ? 'text-emerald-600' : 'text-slate-500'}>
                          {s.status === 'OPEN' ? t('kassa.openState') : t('kassa.closedLabel')}
                        </span>
                      </p>
                      <p className="text-slate-500">
                        {format(new Date(s.opened_at), 'PPp')}
                        {s.closed_at ? ` — ${format(new Date(s.closed_at), 'PPp')}` : ''}
                      </p>
                    </div>
                    {s.status === 'CLOSED' && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">{t('cashRegister.total')}</p>
                        <p className="text-lg font-bold tabular-nums">{formatCurrency(expectedTotal)}</p>
                      </div>
                    )}
                  </div>
                  {s.status === 'CLOSED' && (
                    <>
                      <KassaFactBreakdown
                        title={t('kassa.factLabel')}
                        cash={Number(s.counted_cash ?? 0)}
                        card={Number(s.counted_card ?? 0)}
                        click={Number(s.counted_click ?? 0)}
                      />
                      {shortage > 0 && (
                        <p className="text-right text-xs font-semibold text-red-600 dark:text-red-400">
                          {t('kassa.shortage')}: {formatCurrency(shortage)}
                        </p>
                      )}
                      <SessionKassaExpenses sessionId={s.id} />
                      <SessionSoldItems sessionId={s.id} />
                    </>
                  )}
                </Card>
              );
            })}
            <div className="flex justify-end gap-2 pt-2">
              {historyVisibleCount > pageSize && (
                <Button size="sm" variant="ghost" onClick={() => setHistoryVisibleCount(pageSize)}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={historyVisibleCount >= filteredSessions.length}
                onClick={() =>
                  setHistoryVisibleCount((v) => Math.min(v + pageSize, filteredSessions.length))
                }
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </section>

      {openSession && (
        <CloseCashRegisterModal
          open={closeModalOpen}
          onClose={() => setCloseModalOpen(false)}
          session={openSession}
          onSuccess={() => notify({ type: 'success', title: t('kassa.closedSuccess') })}
          onError={(message) => notify({ type: 'error', title: t('kassa.closeFailed'), message })}
        />
      )}
    </div>
  );
}
