import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Calendar, Pencil, UserCheck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookingFormModal } from '@/components/bookings/BookingFormModal';
import { RestaurantRequired } from '@/components/RestaurantRequired';
import { useAuth } from '@/contexts/AuthContext';
import { useTables } from '@/hooks/useTables';
import {
  useTableBookings,
  useUpdateTableBookingStatus,
  type TableBookingRow,
} from '@/hooks/useTableBookings';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { canCreateOrders } from '@/lib/roles';
import { isBookingArrivalDue } from '@/lib/bookingArrival';
import type { BookingListView } from '@/lib/bookingRange';
import { useLiveSecond } from '@/hooks/useLiveSecond';
import { t, bookingStatus } from '@/i18n';

const statusColor: Record<string, 'green' | 'yellow' | 'blue' | 'gray' | 'red'> = {
  SCHEDULED: 'blue',
  ARRIVED: 'green',
  CANCELLED: 'gray',
  NO_SHOW: 'red',
};

type ViewFilter = BookingListView;

export function BookingsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const notify = useNotificationStore((s) => s.add);
  const canOrder = canCreateOrders(profile?.role);

  const [view, setView] = useState<ViewFilter>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<TableBookingRow | null>(null);
  const [initialTableId, setInitialTableId] = useState<string | undefined>();

  const { data: bookings = [], isLoading, isError, error, refetch } = useTableBookings(view);
  const { data: tables = [] } = useTables();
  const updateStatus = useUpdateTableBookingStatus();

  const filtered = useMemo(() => {
    if (view !== 'upcoming') return bookings;
    return bookings.filter((b) => b.status === 'SCHEDULED');
  }, [bookings, view]);

  const hasDueBookings = useMemo(
    () => filtered.some((b) => b.status === 'SCHEDULED' && isBookingArrivalDue(b.scheduled_at)),
    [filtered],
  );
  useLiveSecond(hasDueBookings);

  const openNew = (tableId?: string) => {
    setEditBooking(null);
    setInitialTableId(tableId);
    setModalOpen(true);
  };

  const openEdit = (row: TableBookingRow) => {
    setEditBooking(row);
    setInitialTableId(undefined);
    setModalOpen(true);
  };

  const setStatus = (id: string, status: 'ARRIVED' | 'CANCELLED' | 'NO_SHOW') => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => notify({ type: 'success', title: t('bookings.statusUpdated') }),
        onError: (err) =>
          notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
      },
    );
  };

  const startOrder = (row: TableBookingRow) => {
    const params = new URLSearchParams({ table: row.table_id });
    navigate(`/orders/new?${params.toString()}`);
  };

  if (!profile?.restaurant_id) {
    return (
      <div className="space-y-6">
        <h2 className="page-title">{t('bookings.title')}</h2>
        <RestaurantRequired />
      </div>
    );
  }

  const viewButtons: { key: ViewFilter; label: string }[] = [
    { key: 'upcoming', label: t('bookings.upcoming') },
    { key: 'today', label: t('filters.today') },
    { key: 'all', label: t('common.all') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">{t('bookings.title')}</h2>
          <p className="text-sm text-slate-500">{t('bookings.subtitle')}</p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="h-4 w-4" /> {t('bookings.new')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {viewButtons.map((v) => (
          <Button
            key={v.key}
            size="sm"
            variant={view === v.key ? 'primary' : 'secondary'}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {isError ? (
        <Card className="max-w-lg space-y-3 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">{t('bookings.loadFailed')}</p>
          <p className="text-sm text-red-700 dark:text-red-300">{getErrorMessage(error)}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('bookings.empty')} description={t('bookings.emptyHint')} />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const tableName = row.tables?.name ?? '—';
            const customerName = row.customers?.name ?? '—';
            const when = format(new Date(row.scheduled_at), 'dd.MM.yyyy HH:mm');
            const due = row.status === 'SCHEDULED' && isBookingArrivalDue(row.scheduled_at);

            return (
              <Card
                key={row.id}
                className={
                  due
                    ? 'flex flex-col gap-3 border-amber-400 bg-amber-50/80 p-4 dark:border-amber-600 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between'
                    : 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'
                }
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{tableName}</span>
                    <Badge color={statusColor[row.status] ?? 'gray'} size="sm">
                      {bookingStatus(row.status)}
                    </Badge>
                    {due && (
                      <Badge color="yellow" size="sm">
                        {t('bookings.callClientNow')}
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {when}
                    <span className="text-slate-400">·</span>
                    {t('bookings.partyOf', { n: row.party_size })}
                  </p>
                  <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                    {customerName}
                    {row.customers?.phone ? (
                      <span className="font-normal text-slate-500"> · {row.customers.phone}</span>
                    ) : null}
                  </p>
                  {due && row.customers?.phone && (
                    <a
                      href={`tel:${row.customers.phone.replace(/\s/g, '')}`}
                      className="text-sm font-medium text-amber-800 underline dark:text-amber-200"
                    >
                      {t('bookings.callClient')}: {row.customers.phone}
                    </a>
                  )}
                  {row.notes && <p className="text-sm text-slate-500">{row.notes}</p>}
                </div>

                {row.status === 'SCHEDULED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                      {t('common.edit')}
                    </Button>
                    {canOrder && (
                      <Button
                        size="sm"
                        loading={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate(
                            { id: row.id, status: 'ARRIVED' },
                            {
                              onSuccess: () => {
                                notify({ type: 'success', title: t('bookings.statusUpdated') });
                                startOrder(row);
                              },
                              onError: (err) =>
                                notify({
                                  type: 'error',
                                  title: t('common.error'),
                                  message: getErrorMessage(err),
                                }),
                            },
                          )
                        }
                      >
                        <UserCheck className="h-4 w-4" />
                        {t('bookings.arrivedAndOrder')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(t('bookings.cancelConfirm'))) setStatus(row.id, 'CANCELLED');
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      {t('bookings.cancel')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BookingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tables={tables}
        editBooking={editBooking}
        initialTableId={initialTableId}
      />
    </div>
  );
}
