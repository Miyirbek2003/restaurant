import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleHomeRedirect } from '@/components/auth/RoleHomeRedirect';
import { LoginPage } from '@/pages/auth/LoginPage';
import { JoinStaffPage } from '@/pages/auth/JoinStaffPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { MenuPage } from '@/pages/menu/MenuPage';
import { TablesPage } from '@/pages/tables/TablesPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { CreateOrderPage } from '@/pages/orders/CreateOrderPage';
import { EditOrderPage } from '@/pages/orders/EditOrderPage';
import { InventoryPage } from '@/pages/inventory/InventoryPage';
import { RestaurantsPage } from '@/pages/admin/RestaurantsPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { PublicMenuPage } from '@/pages/public/PublicMenuPage';
import { QrMenuPage } from '@/pages/qr/QrMenuPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { BookingsPage } from '@/pages/bookings/BookingsPage';
import { SuppliersPage } from '@/pages/suppliers/SuppliersPage';
import { ExpensesPage } from '@/pages/expenses/ExpensesPage';
import { IncomesPage } from '@/pages/incomes/IncomesPage';
import { SalariesPage } from '@/pages/salaries/SalariesPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { DiscountsPage } from '@/pages/discounts/DiscountsPage';
import { EmployeesPage } from '@/pages/employees/EmployeesPage';
import { KassaPage } from '@/pages/kassa/KassaPage';
import { ProductProfitPage } from '@/pages/profit/ProductProfitPage';
import type { UserRole } from '@/types';
import { getHomeForRole } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';

const managerOnly: UserRole[] = ['MANAGER'];
const managerAndCashier: UserRole[] = ['MANAGER', 'CASHIER'];
const waiterOnly: UserRole[] = ['WAITER'];
const waiterAndManager: UserRole[] = ['WAITER', 'MANAGER', 'CASHIER'];
const cashierAndWaiterAndManager: UserRole[] = ['WAITER', 'MANAGER', 'CASHIER'];
const cashierAndManager: UserRole[] = ['CASHIER', 'MANAGER', 'SUPER_ADMIN'];
const adminOnly: UserRole[] = ['SUPER_ADMIN'];

function CatchAllRedirect() {
  const { profile } = useAuth();
  return <Navigate to={getHomeForRole(profile?.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinStaffPage />} />
      <Route path="/menu/:slug" element={<PublicMenuPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={managerOnly}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="admin/restaurants" element={<ProtectedRoute roles={adminOnly}><RestaurantsPage /></ProtectedRoute>} />
        <Route path="admin/analytics" element={<ProtectedRoute roles={adminOnly}><AdminAnalyticsPage /></ProtectedRoute>} />

        <Route path="menu" element={<ProtectedRoute roles={['MANAGER', 'WAITER', 'CASHIER']}><MenuPage /></ProtectedRoute>} />
        <Route path="menu/categories" element={<Navigate to="/menu" replace />} />
        <Route path="menu/products" element={<Navigate to="/menu" replace />} />

        <Route path="tables" element={<ProtectedRoute roles={cashierAndWaiterAndManager}><TablesPage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute roles={cashierAndWaiterAndManager}><BookingsPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute roles={cashierAndWaiterAndManager}><OrdersPage /></ProtectedRoute>} />
        <Route path="orders/new" element={<ProtectedRoute roles={waiterAndManager}><CreateOrderPage /></ProtectedRoute>} />
        <Route path="orders/:id/edit" element={<ProtectedRoute roles={waiterAndManager}><EditOrderPage /></ProtectedRoute>} />
        <Route path="cash-register" element={<ProtectedRoute roles={cashierAndManager}><KassaPage /></ProtectedRoute>} />
        <Route
          path="product-profit"
          element={
            <ProtectedRoute roles={['MANAGER']}>
              <ProductProfitPage />
            </ProtectedRoute>
          }
        />

        <Route path="kitchen" element={<Navigate to="/orders" replace />} />

        <Route path="inventory" element={<ProtectedRoute roles={managerOnly}><InventoryPage /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute roles={managerAndCashier}><ExpensesPage /></ProtectedRoute>} />
        <Route path="suppliers" element={<ProtectedRoute roles={managerOnly}><SuppliersPage /></ProtectedRoute>} />
        <Route path="incomes" element={<ProtectedRoute roles={managerAndCashier}><IncomesPage /></ProtectedRoute>} />
        <Route path="salaries" element={<ProtectedRoute roles={managerOnly}><SalariesPage /></ProtectedRoute>} />
        <Route path="customers" element={<ProtectedRoute roles={managerOnly}><CustomersPage /></ProtectedRoute>} />
        <Route path="discounts" element={<ProtectedRoute roles={managerOnly}><DiscountsPage /></ProtectedRoute>} />
        <Route path="employees" element={<ProtectedRoute roles={managerOnly}><EmployeesPage /></ProtectedRoute>} />
        <Route path="qr-menu" element={<ProtectedRoute roles={managerOnly}><QrMenuPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['MANAGER']}><SettingsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
