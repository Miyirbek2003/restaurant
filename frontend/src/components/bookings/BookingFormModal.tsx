import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useCustomersList } from '@/hooks/useCustomersList';
import { useResourceInsert } from '@/hooks/useResource';
import {
  useCreateTableBooking,
  useUpdateTableBooking,
  type TableBookingRow,
} from '@/hooks/useTableBookings';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { isManager } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  datetimeLocalToIso,
  defaultBookingDatetimeLocal,
  isoToDatetimeLocalValue,
  isDatetimeLocalInPast,
  minFutureDatetimeLocal,
} from '@/lib/datetimeLocal';
import { t } from '@/i18n';

type TableOption = { id: string; name: string; floor: string | null; capacity: number; status: string };

type BookingFormModalProps = {
  open: boolean;
  onClose: () => void;
  tables: TableOption[];
  editBooking?: TableBookingRow | null;
  initialTableId?: string;
};

export function BookingFormModal({
  open,
  onClose,
  tables,
  editBooking,
  initialTableId,
}: BookingFormModalProps) {
  const { profile } = useAuth();
  const canAddCustomer = profile?.role && isManager(profile.role);
  const notify = useNotificationStore((s) => s.add);

  const { data: customers = [], isLoading: customersLoading } = useCustomersList(open);
  const createBooking = useCreateTableBooking();
  const updateBooking = useUpdateTableBooking();
  const insertCustomer = useResourceInsert('customers');

  const [tableId, setTableId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState(defaultBookingDatetimeLocal);
  const minScheduled = useMemo(() => (open ? minFutureDatetimeLocal() : ''), [open]);
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  const isEdit = Boolean(editBooking);
  const editable = !editBooking || editBooking.status === 'SCHEDULED';

  useEffect(() => {
    if (!open) return;
    if (editBooking) {
      setTableId(editBooking.table_id);
      setCustomerId(editBooking.customer_id);
      setScheduledLocal(isoToDatetimeLocalValue(editBooking.scheduled_at));
      setPartySize(String(editBooking.party_size));
      setNotes(editBooking.notes ?? '');
    } else {
      setTableId(initialTableId ?? tables[0]?.id ?? '');
      setCustomerId('');
      setScheduledLocal(defaultBookingDatetimeLocal());
      setPartySize('2');
      setNotes('');
    }
    setShowQuickCustomer(false);
    setQuickName('');
    setQuickPhone('');
  }, [open, editBooking, initialTableId, tables]);

  const tableOptions = useMemo(
    () =>
      tables.map((tbl) => ({
        value: tbl.id,
        label: `${tbl.name}${tbl.floor ? ` · ${tbl.floor}` : ''} (${tbl.capacity})`,
      })),
    [tables],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: [c.name, c.phone].filter(Boolean).join(' · '),
      })),
    [customers],
  );

  const handleQuickCustomer = async () => {
    if (!quickName.trim()) {
      notify({ type: 'error', title: t('bookings.customerNameRequired') });
      return;
    }
    try {
      const row = await insertCustomer.mutateAsync({
        name: quickName.trim(),
        phone: quickPhone.trim() || null,
        birthday: null,
        notes: null,
        loyalty_points: 0,
      });
      setCustomerId(row.id as string);
      setShowQuickCustomer(false);
      notify({ type: 'success', title: t('customers.added') });
    } catch (err) {
      notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId || !customerId) {
      notify({ type: 'error', title: t('bookings.fillRequired') });
      return;
    }
    let scheduled_at: string;
    try {
      scheduled_at = datetimeLocalToIso(scheduledLocal);
    } catch {
      notify({ type: 'error', title: t('bookings.invalidDateTime') });
      return;
    }
    if (!isEdit && isDatetimeLocalInPast(scheduledLocal)) {
      notify({ type: 'error', title: t('bookings.pastDateTime') });
      return;
    }
    const ps = parseInt(partySize, 10);
    if (Number.isNaN(ps) || ps < 1) {
      notify({ type: 'error', title: t('bookings.invalidPartySize') });
      return;
    }

    try {
      if (isEdit && editBooking) {
        await updateBooking.mutateAsync({
          id: editBooking.id,
          table_id: tableId,
          customer_id: customerId,
          scheduled_at,
          party_size: ps,
          notes: notes.trim() || null,
        });
        notify({ type: 'success', title: t('bookings.updated') });
      } else {
        await createBooking.mutateAsync({
          table_id: tableId,
          customer_id: customerId,
          scheduled_at,
          party_size: ps,
          notes: notes.trim() || null,
        });
        notify({ type: 'success', title: t('bookings.created') });
      }
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (
        msg.includes('TABLE_BOOKING_OVERLAP') ||
        msg.includes('ux_table_bookings_scheduled_table') ||
        msg.includes('duplicate key')
      ) {
        notify({ type: 'error', title: t('bookings.tableAlreadyBooked') });
      } else {
        notify({ type: 'error', title: t('common.error'), message: msg });
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('bookings.edit') : t('bookings.new')}
    >
      {open && customersLoading ? (
        <Spinner />
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Select
            label={t('bookings.table')}
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            options={[{ value: '', label: '—' }, ...tableOptions]}
            required
            disabled={!editable}
          />

          {customers.length === 0 && !showQuickCustomer ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm dark:border-slate-600">
              <p className="text-slate-600 dark:text-slate-400">{t('bookings.noCustomers')}</p>
              {canAddCustomer ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => setShowQuickCustomer(true)}>
                    {t('bookings.addCustomerQuick')}
                  </Button>
                  <Link to="/customers" className="text-sm font-medium text-primary-600 hover:underline">
                    {t('bookings.openCustomers')}
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-slate-500">{t('bookings.askManagerForCustomer')}</p>
              )}
            </div>
          ) : (
            <>
              <Select
                label={t('bookings.customer')}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={[{ value: '', label: t('bookings.pickCustomer') }, ...customerOptions]}
                required
                disabled={!editable}
              />
              {canAddCustomer && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    className="font-medium text-primary-600 hover:underline"
                    onClick={() => setShowQuickCustomer((v) => !v)}
                  >
                    {showQuickCustomer ? t('bookings.hideQuickCustomer') : t('bookings.addCustomerQuick')}
                  </button>
                  <Link to="/customers" className="text-slate-500 hover:text-primary-600">
                    {t('bookings.openCustomers')}
                  </Link>
                </div>
              )}
            </>
          )}

          {showQuickCustomer && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <Input
                label={t('common.name')}
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                required
              />
              <Input
                label={t('common.phone')}
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={insertCustomer.isPending}
                onClick={() => void handleQuickCustomer()}
              >
                {t('bookings.saveCustomerAndSelect')}
              </Button>
            </div>
          )}

          <Input
            label={t('bookings.dateTime')}
            type="datetime-local"
            value={scheduledLocal}
            min={isEdit ? undefined : minScheduled}
            onChange={(e) => {
              const v = e.target.value;
              if (!isEdit && v && isDatetimeLocalInPast(v)) {
                setScheduledLocal(minFutureDatetimeLocal());
                return;
              }
              setScheduledLocal(v);
            }}
            required
            disabled={!editable}
          />
          <Input
            label={t('bookings.partySize')}
            type="number"
            min="1"
            max="99"
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            required
            disabled={!editable}
          />
          <Input
            label={t('common.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!editable}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            {editable && (
              <Button type="submit" loading={createBooking.isPending || updateBooking.isPending}>
                {t('common.save')}
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
