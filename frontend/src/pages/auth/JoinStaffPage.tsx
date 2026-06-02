import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { usePreviewInvite } from '@/hooks/useStaffInvites';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeForRole } from '@/lib/roles';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';
import {
  completeWaiterInvite,
  completeCashierInvite,
  registerStaffFromInvite,
  savePendingWaiterInvite,
  savePendingCashierInvite,
  isAlreadyRegisteredError,
} from '@/lib/staffInvite';

type StatusBanner = { type: 'error' | 'info' | 'success'; title: string; message?: string };

export function JoinStaffPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [code, setCode] = useState(params.get('code') ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusBanner | null>(null);

  const { data: preview, isFetching, isError } = usePreviewInvite(code);
  const isWaiterInvite = preview?.role === 'WAITER';
  const isCashierInvite = preview?.role === 'CASHIER';
  const needsEmailSignup = isWaiterInvite || isCashierInvite;

  useEffect(() => {
    const c = params.get('code');
    if (c) setCode(c);
  }, [params]);

  const finishWaiterJoin = async (inviteCode: string) => {
    await completeWaiterInvite(inviteCode, name, phone);
    await refreshProfile();
    navigate(getHomeForRole('WAITER'), { replace: true });
  };

  const finishCashierJoin = async (inviteCode: string) => {
    await completeCashierInvite(inviteCode, name, phone);
    await refreshProfile();
    navigate(getHomeForRole('CASHIER'), { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const inviteCode = code.trim().toUpperCase();
    if (!inviteCode) {
      setStatus({ type: 'error', title: t('join.codeRequired') });
      return;
    }
    if (!preview) {
      setStatus({
        type: 'error',
        title: t('join.invalidInvite'),
        message: t('join.invalidInviteMsg'),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (needsEmailSignup) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });

        if (signUpErr) {
          if (isAlreadyRegisteredError(signUpErr.message)) {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (signInErr) {
              throw new Error(t('join.emailExists'));
            }
            if (isCashierInvite) {
              await finishCashierJoin(inviteCode);
            } else {
              await finishWaiterJoin(inviteCode);
            }
            return;
          }
          throw signUpErr;
        }

        if (!signUpData.session) {
          if (isCashierInvite) {
            savePendingCashierInvite({ code: inviteCode, name, phone });
          } else {
            savePendingWaiterInvite({ code: inviteCode, name, phone });
          }
          setStatus({
            type: 'info',
            title: t('join.confirmEmail'),
            message: t('join.confirmEmailMsg'),
          });
          return;
        }

        if (isCashierInvite) {
          await finishCashierJoin(inviteCode);
        } else {
          await finishWaiterJoin(inviteCode);
        }
        return;
      }

      const result = await registerStaffFromInvite(inviteCode, name, phone);
      setStatus({
        type: 'success',
        title: t('join.onTeam'),
        message: t('join.kitchenAdded', {
          name: result?.name ?? name,
          restaurant: preview.restaurant_name,
        }),
      });
      setName('');
      setPhone('');
    } catch (err) {
      setStatus({
        type: 'error',
        title: t('join.registerFailed'),
        message: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const bannerStyles = {
    error: 'border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100',
    info: 'border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100',
    success:
      'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-8 w-8 text-primary-500" />
          <h1 className="text-xl font-bold">{t('join.title')}</h1>
        </div>

        {status && (
          <div className={`rounded-lg border p-4 text-sm ${bannerStyles[status.type]}`}>
            <p className="font-semibold">{status.title}</p>
            {status.message && <p className="mt-2">{status.message}</p>}
            {status.type === 'info' && (
              <Link to="/login" className="mt-3 inline-block font-medium text-primary-600 hover:underline">
                {t('join.goSignIn')}
              </Link>
            )}
          </div>
        )}

        <Input
          label={t('join.inviteCode')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('join.invitePlaceholder')}
          required
        />

        {code.length >= 4 && isFetching && <Spinner />}
        {preview && (
          <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800 dark:bg-primary-900/30 dark:text-primary-200">
            {t('join.joiningLine', {
              restaurant: preview.restaurant_name,
            role: isCashierInvite ? t('employees.cashier') : isWaiterInvite ? t('employees.waiter') : t('employees.kitchen'),
            })}
          {isWaiterInvite && <> — {t('join.waiterHint')}</>}
          </p>
        )}
        {code.length >= 4 && isError && !isFetching && (
          <p className="text-sm text-red-600">{t('join.invalidCode')}</p>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <Input label={t('join.yourName')} value={name} onChange={(e) => setName(e.target.value)} required />
          {needsEmailSignup && (
            <>
              <Input
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label={t('join.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </>
          )}
          <Input label={t('join.phoneOptional')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={!preview || isFetching || (status?.type === 'success' && !needsEmailSignup)}
          >
            {needsEmailSignup ? t('join.createAndJoin') : t('join.register')}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500">
          {t('join.hasAccount')}{' '}
          <Link to="/login" className="text-primary-600 hover:underline">
            {t('join.signIn')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
