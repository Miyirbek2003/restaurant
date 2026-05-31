import type { UserRole } from '@/types';

export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin/restaurants',
  MANAGER: '/dashboard',
  WAITER: '/tables',
  KITCHEN: '/login',
};

export function getHomeForRole(role: UserRole | undefined): string {
  return role ? ROLE_HOME[role] : '/login';
}

/** Routes a role may access (path prefixes) */
const ROUTE_ACCESS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['/admin', '/dashboard'],
  MANAGER: [
    '/dashboard',
    '/menu',
    '/tables',
    '/orders',
    '/inventory',
    '/suppliers',
    '/expenses',
    '/customers',
    '/discounts',
    '/employees',
    '/qr-menu',
  ],
  WAITER: ['/tables', '/orders', '/menu'],
  KITCHEN: [],
};

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const allowed = ROUTE_ACCESS[role];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isManager(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN';
}

export function isWaiter(role: UserRole): boolean {
  return role === 'WAITER';
}

/** Waiters and managers can start orders from Tables / Orders. */
export function canPlaceOrders(role: UserRole | undefined): boolean {
  return !!role && (isWaiter(role) || isManager(role));
}
