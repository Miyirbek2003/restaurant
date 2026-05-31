import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ShoppingCart,
  Package,
  Truck,
  Receipt,
  Users,
  UserCircle,
  Percent,
  QrCode,
  Building2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  roles: UserRole[];
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    roles: ['MANAGER', 'SUPER_ADMIN'],
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['MANAGER'] },
      { to: '/admin/restaurants', label: 'Restaurants', icon: Building2, roles: ['SUPER_ADMIN'] },
      { to: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Menu',
    roles: ['MANAGER', 'WAITER'],
    items: [{ to: '/menu', label: 'Categories & products', icon: UtensilsCrossed, roles: ['MANAGER', 'WAITER'] }],
  },
  {
    label: 'Floor',
    roles: ['MANAGER', 'WAITER'],
    items: [
      { to: '/tables', label: 'Tables', icon: Grid3X3, roles: ['MANAGER', 'WAITER'] },
      { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['MANAGER', 'WAITER'] },
    ],
  },
  {
    label: 'Back office',
    roles: ['MANAGER'],
    items: [
      { to: '/inventory', label: 'Warehouse', icon: Package, roles: ['MANAGER'] },
      { to: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['MANAGER'] },
      { to: '/expenses', label: 'Expenses', icon: Receipt, roles: ['MANAGER'] },
      { to: '/employees', label: 'Staff', icon: Users, roles: ['MANAGER'] },
      { to: '/customers', label: 'Customers', icon: UserCircle, roles: ['MANAGER'] },
      { to: '/discounts', label: 'Discounts', icon: Percent, roles: ['MANAGER'] },
    ],
  },
  {
    label: 'Marketing',
    roles: ['MANAGER'],
    items: [{ to: '/qr-menu', label: 'QR Menu', icon: QrCode, roles: ['MANAGER'] }],
  },
];

export function Sidebar() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'WAITER';

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6 dark:border-slate-800">
        <UtensilsCrossed className="h-7 w-7 text-primary-500" />
        <span className="text-lg font-bold">RestoPOS</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-4">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(role));
          if (!group.roles.includes(role) || items.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
