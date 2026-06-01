import { Moon, Sun, LogOut, Bell, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeStore } from '@/stores/themeStore';
import { useMobileNav } from '@/contexts/MobileNavContext';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { t, roleLabel } from '@/i18n';

export function Topbar() {
  const { profile, signOut } = useAuth();
  const { dark, toggle } = useThemeStore();
  const { setOpen } = useMobileNav();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const restaurantName =
    (profile?.restaurants as { name: string } | null)?.name ?? t('common.platformAdmin');

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
      <button
        type="button"
        className="touch-target -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label={t('nav.openMenu')}
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold sm:text-lg">{restaurantName}</h1>
        <p className="truncate text-xs text-slate-500">{roleLabel(profile?.role)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <button
          type="button"
          className="touch-target rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.notifications')}
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="touch-target rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.toggleTheme')}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <span className="hidden max-w-[8rem] truncate text-sm text-slate-600 dark:text-slate-400 md:block">
          {profile?.name}
        </span>
        <Button variant="ghost" size="sm" className="touch-target px-2 sm:px-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.logout')}</span>
        </Button>
      </div>
    </header>
  );
}
