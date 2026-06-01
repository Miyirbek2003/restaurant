import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { canAccessPath, getHomeForRole, hasRequiredRoles } from '@/lib/roles';
import type { UserRole } from '@/types';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { session, profile, loading, authError, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-4">
          <h2 className="text-lg font-semibold text-red-600">Cannot connect to Supabase</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{authError}</p>
          <p className="text-xs text-slate-500">
            In <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">frontend/.env</code> use
            Project Settings → API → <strong>anon public</strong> key (starts with eyJ…), not only the
            publishable key.
          </p>
          <Button variant="ghost" onClick={() => signOut()}>
            Back to login
          </Button>
        </Card>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.status !== 'ACTIVE') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-4">
          <h2 className="text-lg font-semibold text-red-600">Account blocked</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your account status is <strong>{profile.status}</strong>. Contact your restaurant manager.
          </p>
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  const role = profile?.role;
  const home = getHomeForRole(role);

  if (roles && profile && !hasRequiredRoles(profile.role, roles)) {
    return <Navigate to={home} replace />;
  }

  if (roles && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-4">
          <h2 className="text-lg font-semibold">Profile not set up</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your login exists but there is no row in <code>profiles</code>, or RLS blocked the read.
            Run the SQL migrations and link your user (see README).
          </p>
          <Button onClick={() => refreshProfile()}>Retry</Button>
        </Card>
      </div>
    );
  }

  if (role && !roles) {
    const pathAllowed =
      canAccessPath(role, location.pathname) || location.pathname.startsWith('/orders/');
    if (!pathAllowed) return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
