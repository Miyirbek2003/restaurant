import { useEffect, useMemo, useState } from 'react';
import { Delete, UtensilsCrossed, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import {
  listTerminalStaff,
  pinLogin,
  getTerminalConfig,
  type TerminalStaff,
  type PinLoginError,
} from '@/lib/waiterTerminal';
import { t } from '@/i18n';

const PIN_LENGTH = 4;

type Props = {
  onManagerLogin: () => void;
};

export function WaiterLockScreen({ onManagerLogin }: Props) {
  const config = getTerminalConfig();
  const [staff, setStaff] = useState<TerminalStaff[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TerminalStaff | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStaff = () => {
    setStaff(null);
    setLoadError(null);
    listTerminalStaff()
      .then(setStaff)
      .catch((e) => setLoadError(getErrorMessage(e)));
  };

  useEffect(() => {
    refreshStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPin = async (fullPin: string) => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await pinLogin(selected.id, fullPin);
      // AuthContext picks up the new session and the login route redirects.
    } catch (e) {
      const err = e as PinLoginError;
      if (err.code === 'locked') {
        setError(t('terminal.lockedOut'));
      } else if (err.code === 'invalid_pin') {
        setError(t('terminal.wrongPin'));
      } else {
        setError(getErrorMessage(e));
      }
      setPin('');
      setSubmitting(false);
    }
  };

  const pressDigit = (d: string) => {
    if (submitting) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH) void submitPin(next);
      return next;
    });
  };

  const backspace = () => {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const resetToStaff = () => {
    setSelected(null);
    setPin('');
    setError(null);
  };

  const keypad = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9'], []);

  return (
    <div className="flex min-h-dvh min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="mb-8 flex items-center gap-2 text-primary-600 dark:text-primary-400">
        <UtensilsCrossed className="h-8 w-8" />
        <span className="text-2xl font-bold">RestoPOS</span>
        {config?.label && <span className="text-sm text-slate-400">· {config.label}</span>}
      </div>

      {!selected ? (
        <div className="w-full max-w-2xl">
          <h1 className="mb-4 text-center text-lg font-semibold">{t('terminal.selectStaff')}</h1>
          {loadError ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button variant="secondary" onClick={refreshStaff}>
                {t('common.retry')}
              </Button>
            </div>
          ) : staff === null ? (
            <Spinner />
          ) : staff.length === 0 ? (
            <p className="text-center text-sm text-slate-500">{t('terminal.noStaffWithPin')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    setPin('');
                    setError(null);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center',
                    'transition hover:border-primary-300 active:scale-[0.98]',
                    'dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-600',
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                    {s.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={onManagerLogin}
              className="text-sm text-slate-500 hover:text-primary-600 hover:underline"
            >
              {t('terminal.managerLogin')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <button
            type="button"
            onClick={resetToStaff}
            className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
          >
            <ArrowLeft className="h-4 w-4" /> {t('common.back')}
          </button>

          <h1 className="text-center text-lg font-semibold">{selected.name}</h1>
          <p className="mb-6 text-center text-sm text-slate-500">{t('terminal.enterPin')}</p>

          <div className="mb-6 flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  i < pin.length
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-slate-300 dark:border-slate-600',
                )}
              />
            ))}
          </div>

          {error && <p className="mb-4 text-center text-sm text-red-600">{error}</p>}
          {submitting && <Spinner />}

          <div className="grid grid-cols-3 gap-3">
            {keypad.map((d) => (
              <button
                key={d}
                type="button"
                disabled={submitting}
                onClick={() => pressDigit(d)}
                className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold transition active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
              >
                {d}
              </button>
            ))}
            <span />
            <button
              type="button"
              disabled={submitting}
              onClick={() => pressDigit('0')}
              className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold transition active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
            >
              0
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={backspace}
              className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white transition active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
              aria-label={t('terminal.delete')}
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
