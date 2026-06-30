import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowLeft, UtensilsCrossed } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLogin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeForRole } from '@/lib/roles';
import { isWaiterTerminal } from '@/lib/waiterTerminal';
import { WaiterLockScreen } from '@/pages/auth/WaiterLockScreen';
import { t } from '@/i18n';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forcePasswordLogin, setForcePasswordLogin] = useState(false);
  const login = useLogin();
  const { session, profile, loading } = useAuth();
  const onTerminal = isWaiterTerminal();

  if (!loading && session) {
    return <Navigate to={getHomeForRole(profile?.role)} replace />;
  }

  if (onTerminal && !forcePasswordLogin) {
    return <WaiterLockScreen onManagerLogin={() => setForcePasswordLogin(true)} />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    login.mutate(
      { email, password, managerOnly: onTerminal },
      {
        onError: (err) => setLoginError(err instanceof Error ? err.message : String(err)),
      },
    );
  };

  return (
    <div className="flex min-h-dvh min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-primary-600 to-primary-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="h-10 w-10" />
          <span className="text-2xl font-bold">RestoPOS</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold">{t('auth.heroTitle')}</h2>
          <p className="mt-4 max-w-md text-primary-100">{t('auth.heroSubtitle')}</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 pb-safe sm:p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          {onTerminal && (
            <button
              type="button"
              onClick={() => {
                setForcePasswordLogin(false);
                setLoginError(null);
              }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('terminal.backToPin')}
            </button>
          )}
          <h1 className="text-2xl font-bold">
            {onTerminal ? t('terminal.managerLoginTitle') : t('auth.signIn')}
          </h1>
          {onTerminal && (
            <p className="text-sm text-slate-500">{t('terminal.managerLoginHint')}</p>
          )}
          {loginError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
              {loginError}
            </p>
          )}
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete={onTerminal ? 'username' : 'email'}
            required
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={onTerminal ? 'new-password' : 'current-password'}
            required
          />
          <Button type="submit" className="w-full" loading={login.isPending}>
            {t('auth.signInButton')}
          </Button>
          {!onTerminal && (
            <p className="text-center text-sm text-slate-500">
              {t('auth.staffJoin')}{' '}
              <a href="/join" className="text-primary-600 hover:underline">
                {t('auth.joinInvite')}
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
