import { Moon, Sun, LogOut, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function Topbar() {
  const { profile, signOut } = useAuth();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const restaurantName =
    (profile?.restaurants as { name: string } | null)?.name ?? 'Platform Admin';

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h1 className="text-lg font-semibold">{restaurantName}</h1>
        <p className="text-xs text-slate-500">{profile?.role?.replace('_', ' ')}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <span className="hidden text-sm text-slate-600 dark:text-slate-400 sm:block">{profile?.name}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
