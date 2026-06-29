import { useCallback, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { OrderEditView } from '@/components/orders/OrderEditView';
import { t } from '@/i18n';

type OrderDetailModalProps = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
};

export function OrderDetailModal({ orderId, open, onClose }: OrderDetailModalProps) {
  const [modalTitle, setModalTitle] = useState(t('orderDetail.titleFallback'));
  const [canEdit, setCanEdit] = useState(false);
  const closeAttemptRef = useRef<() => void>(() => onClose());

  const handleMetaChange = useCallback((meta: { title: string; canEdit: boolean }) => {
    setModalTitle(meta.title);
    setCanEdit(meta.canEdit);
  }, []);

  const handleRegisterCloseAttempt = useCallback((fn: () => void) => {
    closeAttemptRef.current = fn;
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => closeAttemptRef.current()}
      title={modalTitle}
      className={canEdit ? 'max-w-2xl' : 'max-w-md'}
    >
      {open && orderId && (
        <OrderEditView
          orderId={orderId}
          variant="embedded"
          onClose={onClose}
          onMetaChange={handleMetaChange}
          onRegisterCloseAttempt={handleRegisterCloseAttempt}
        />
      )}
    </Modal>
  );
}
