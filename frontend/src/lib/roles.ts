import type { UserRole } from '@/types';

export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/restaurants',
  MANAGER: '/dashboard',
  WAITER: '/tables',
  KITCHEN: '/login',
  CASHIER: '/kassa',
};

/** Paths for restaurant back-office (manager UI). Keep in sync with App.tsx routes. */
export const MANAGER_PATH_PREFIXES = [
  '/dashboard',
  '/menu',
  '/tables',
  '/orders',
  '/inventory',
  '/expenses',
  '/suppliers',
  '/incomes',
  '/salaries',
  '/customers',
  '/discounts',
  '/employees',
  '/qr-menu',
  '/kassa',
  '/product-profit',
] as const;

export const CASHIER_PATH_PREFIXES = ['/kassa', '/orders', '/tables'] as const;

export const MANAGER_ROUTE_ROLES: UserRole[] = ['MANAGER'];

export function getHomeForRole(role: UserRole | undefined): string {
  return role ? ROLE_HOME[role] : '/login';
}

/** Routes a role may access (path prefixes) */
const ROUTE_ACCESS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['/admin', '/dashboard'],
  MANAGER: [...MANAGER_PATH_PREFIXES],
  WAITER: ['/tables', '/orders', '/menu'],
  CASHIER: [...MANAGER_PATH_PREFIXES],
  KITCHEN: [],
};

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const allowed = ROUTE_ACCESS[role] ?? [];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function hasRequiredRoles(
  userRole: UserRole | undefined,
  required: UserRole[] | undefined,
): boolean {
  if (!required?.length) return true;
  if (!userRole) return false;
  return required.includes(userRole);
}

export function isManager(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN';
}

export function isWaiter(role: UserRole): boolean {
  return role === 'WAITER';
}

export function isCashier(role: UserRole): boolean {
  return role === 'CASHIER';
}

/** Waiters and managers can start orders from Tables / Orders. */
export function canPlaceOrders(role: UserRole | undefined): boolean {
  return !!role && (isWaiter(role) || isManager(role));
}

/** Create new orders (cashier only as takeaway in UI). */
export function canCreateOrders(role: UserRole | undefined): boolean {
  return !!role && (canPlaceOrders(role) || isCashier(role));
}

/** Pay orders and operate the cash register. */
export function canPayOrders(role: UserRole | undefined): boolean {
  return !!role && (canCreateOrders(role) || isCashier(role));
}

export function canOperateCashRegister(role: UserRole | undefined): boolean {
  return !!role && (isManager(role) || isCashier(role));
}
