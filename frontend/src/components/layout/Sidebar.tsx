import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ShoppingCart,
  CalendarDays,
  Package,
  Truck,
  Receipt,
  Banknote,
  Wallet,
  Users,
  UserCircle,
  Percent,
  QrCode,
  Building2,
  BarChart3,
  TrendingUp,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMobileNav } from '@/contexts/MobileNavContext';
import { t } from '@/i18n';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

interface NavGroup {
  labelKey: string;
  roles: UserRole[];
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.overview',
    roles: ['MANAGER', 'SUPER_ADMIN'],
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['MANAGER'] },
      { to: '/admin/restaurants', labelKey: 'nav.restaurants', icon: Building2, roles: ['SUPER_ADMIN'] },
      { to: '/admin/analytics', labelKey: 'nav.platformAnalytics', icon: BarChart3, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    labelKey: 'nav.menu',
    roles: ['MANAGER', 'WAITER', 'CASHIER'],
    items: [{ to: '/menu', labelKey: 'nav.categoriesProducts', icon: UtensilsCrossed, roles: ['MANAGER', 'WAITER', 'CASHIER'] }],
  },
  {
    labelKey: 'nav.floor',
    roles: ['MANAGER', 'WAITER', 'CASHIER'],
    items: [
      { to: '/tables', labelKey: 'nav.tables', icon: Grid3X3, roles: ['MANAGER', 'WAITER', 'CASHIER'] },
      { to: '/orders', labelKey: 'nav.orders', icon: ShoppingCart, roles: ['MANAGER', 'WAITER', 'CASHIER'] },
      { to: '/bookings', labelKey: 'nav.bookings', icon: CalendarDays, roles: ['MANAGER', 'WAITER', 'CASHIER'] },
    ],
  },
  {
    labelKey: 'nav.backOffice',
    roles: ['MANAGER', 'CASHIER'],
    items: [
      { to: '/inventory', labelKey: 'nav.warehouse', icon: Package, roles: ['MANAGER', 'CASHIER'] },
      { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt, roles: ['MANAGER', 'CASHIER'] },
      { to: '/incomes', labelKey: 'nav.incomes', icon: Banknote, roles: ['MANAGER', 'CASHIER'] },
      { to: '/kassa', labelKey: 'nav.kassa', icon: Wallet, roles: ['MANAGER', 'CASHIER'] },
      { to: '/product-profit', labelKey: 'nav.productProfit', icon: TrendingUp, roles: ['MANAGER'] },
    ],
  },
  {
    labelKey: 'nav.others',
    roles: ['MANAGER'],
    items: [
      { to: '/employees', labelKey: 'nav.staff', icon: Users, roles: ['MANAGER'] },
      { to: '/salaries', labelKey: 'nav.salaries', icon: Wallet, roles: ['MANAGER'] },
      { to: '/suppliers', labelKey: 'nav.suppliers', icon: Truck, roles: ['MANAGER'] },
    ],
  },
  {
    labelKey: 'nav.marketing',
    roles: ['MANAGER'],
    items: [
      { to: '/customers', labelKey: 'nav.customers', icon: UserCircle, roles: ['MANAGER'] },
      { to: '/discounts', labelKey: 'nav.discounts', icon: Percent, roles: ['MANAGER'] },
      { to: '/qr-menu', labelKey: 'nav.qrMenu', icon: QrCode, roles: ['MANAGER'] },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings, roles: ['MANAGER'] },
    ],
  },
];

export function Sidebar() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'WAITER';
  const { open, close } = useMobileNav();
  const location = useLocation();

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-label={t('common.close')}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900',
          'lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-64 lg:shrink-0 lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800 sm:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 shrink-0 text-primary-500" />
            <span className="truncate text-lg font-bold">RestoPOS</span>
          </div>
          <button
            type="button"
            className="touch-target rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {navGroups.map((group) => {
            const items = group.items.filter((item) => item.roles.includes(role));
            if (!group.roles.includes(role) || items.length === 0) return null;

            return (
              <div key={group.labelKey}>
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to + item.labelKey}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                          isActive
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
