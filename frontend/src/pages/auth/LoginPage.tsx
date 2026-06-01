import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLogin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeForRole } from '@/lib/roles';
import { t } from '@/i18n';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const { session, profile, loading } = useAuth();

  if (!loading && session) {
    return <Navigate to={getHomeForRole(profile?.role)} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
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
          <h1 className="text-2xl font-bold">{t('auth.signIn')}</h1>
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" loading={login.isPending}>
            {t('auth.signInButton')}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {t('auth.staffJoin')}{' '}
            <a href="/join" className="text-primary-600 hover:underline">
              {t('auth.joinInvite')}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
