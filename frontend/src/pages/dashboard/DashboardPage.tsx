import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, ShoppingBag, Table2, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useDashboard, useRevenueChart } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-primary-50 p-3 dark:bg-primary-900/30">
          <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { profile } = useAuth();
  const currency = (profile?.restaurants as { currency?: string } | null)?.currency ?? 'USD';
  const { data, isLoading, error } = useDashboard();
  const { data: chartData } = useRevenueChart('daily');

  if (profile?.role === 'SUPER_ADMIN') {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">{t('dashboard.platformTitle')}</h2>
        <p className="text-slate-500">{t('dashboard.platformHint')}</p>
      </div>
    );
  }

  if (!profile?.restaurant_id) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
        <h2 className="font-semibold">{t('dashboard.notLinked')}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('dashboard.notLinkedHint')}</p>
      </div>
    );
  }

  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="text-red-500">{t('dashboard.loadFailed')}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('dashboard.revenueToday')} value={formatCurrency(data.revenueToday, currency)} icon={DollarSign} />
        <StatCard title={t('dashboard.revenueMonth')} value={formatCurrency(data.revenueMonth, currency)} icon={TrendingUp} />
        <StatCard
          title={t('dashboard.openOrders')}
          value={String(data.openOrders)}
          icon={ShoppingBag}
          subtitle={t('dashboard.ordersToday', { n: data.ordersToday })}
        />
        <StatCard
          title={t('dashboard.tablesOccupied')}
          value={`${data.occupiedTables}/${data.totalTables}`}
          icon={Table2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.revenue')}</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f680" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.profitThisMonth')}</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-slate-500">{t('dashboard.revenue')}</span>
              <span className="font-medium text-emerald-600">{formatCurrency(data.revenueMonth, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t('dashboard.expenses')}</span>
              <span className="font-medium text-red-500">{formatCurrency(data.expensesMonth, currency)}</span>
            </div>
            <hr className="border-slate-200 dark:border-slate-700" />
            <div className="flex justify-between text-lg font-bold">
              <span>{t('dashboard.netProfit')}</span>
              <span className={data.profitMonth >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                {formatCurrency(data.profitMonth, currency)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.bestSellers')}</CardTitle>
        </CardHeader>
        <ul className="space-y-2">
          {data.bestSellers.map((item) => (
            <li key={item.name} className="flex justify-between text-sm">
              <span>{item.name}</span>
              <span className="text-slate-500">{t('dashboard.soldCount', { n: item.quantity })}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
