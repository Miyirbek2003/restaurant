import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Notifications } from '@/components/ui/Notifications';
import { MobileNavProvider } from '@/contexts/MobileNavContext';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function DashboardLayout() {
  const dark = useThemeStore((s) => s.dark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <MobileNavProvider>
      <div className="flex h-dvh min-w-0 overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="main-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Notifications />
    </MobileNavProvider>
  );
}
