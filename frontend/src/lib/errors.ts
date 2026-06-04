import { t } from '@/i18n';

export function getErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : t('errors.unexpected');

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  if (code === '42P01' || /staff_invites|restaurant_staff|register_staff_from_invite|cash_register_closures/i.test(raw)) {
    return t('errors.migration');
  }
  if (/row-level security/i.test(raw) || code === '42501') {
    return t('errors.rls', { raw });
  }
  if (/Could not find a relationship/i.test(raw)) {
    return t('errors.relationship', { raw });
  }
  if (raw === 'SELECT_CATEGORY') {
    return t('errors.selectCategory');
  }
  if (raw === 'KITCHEN_ITEM_NOT_FOR_MENU') {
    return t('warehouse.kitchenNotForMenu');
  }
  if (/ITEM_IN_KITCHEN/i.test(raw)) {
    return t('errors.itemInKitchen');
  }
  if (raw === 'ITEM_IN_KITCHEN') {
    return t('errors.itemInKitchen');
  }
  if (raw === 'ORDER_NOT_EDITABLE') {
    return t('errors.orderNotEditable');
  }
  if (raw === 'INSUFFICIENT_STOCK') {
    return t('errors.insufficientStock');
  }
  if (raw === 'TABLE_OCCUPIED') {
    return t('errors.tableOccupied');
  }
  if (raw === 'ORDER_DISCARD_WINDOW_EXPIRED') {
    return t('errors.orderDiscardWindowExpired');
  }
  if (raw === 'ORDER_CANNOT_DISCARD') {
    return t('errors.orderCannotDiscard');
  }
  if (raw === 'CASH_REGISTER_ALREADY_OPEN') {
    return t('errors.cashRegisterAlreadyOpen');
  }
  if (raw === 'PAYMENT_TOTAL_MISMATCH') {
    return t('errors.paymentTotalMismatch');
  }
  if (raw === 'CASH_REGISTER_OPENED_BY_ANOTHER_CASHIER') {
    return t('errors.cashRegisterOpenedByAnotherCashier');
  }
  if (raw === 'CASH_REGISTER_NOT_OPEN') {
    return t('errors.cashRegisterNotOpen');
  }
  if (raw === 'USER_NOT_FOUND' || raw === 'PROFILE_NOT_FOUND') {
    return t('errors.userNotFound');
  }
  if (raw === 'EMAIL_REQUIRED') {
    return t('errors.emailRequired');
  }
  if (raw === 'MANAGER_PASSWORD_REQUIRED') {
    return t('admin.managerCredentialsRequired');
  }
  if (raw === 'MANAGER_EMAIL_CONFIRM_REQUIRED') {
    return t('admin.managerEmailConfirmRequired');
  }
  if (raw === 'RESTAURANT_NOT_FOUND') {
    return t('errors.restaurantNotFound');
  }
  if (raw === 'CANNOT_ASSIGN_SUPER_ADMIN') {
    return t('errors.cannotAssignSuperAdmin');
  }
  if (/already exists/i.test(raw)) {
    return t('errors.userEmailExists');
  }
  if (/Insufficient stock/i.test(raw)) {
    return raw;
  }
  if (/order_items_product_id_fkey|violates foreign key constraint.*products/i.test(raw)) {
    return t('errors.productInOrders');
  }
  if (/products_category_id_fkey|violates foreign key constraint.*categories/i.test(raw)) {
    return t('errors.categoryHasProducts');
  }
  if (/function.*remove_menu_product.*does not exist|record_inventory_purchase|order_items_product_name/i.test(raw) && /does not exist|column/i.test(raw)) {
    return t('errors.migration');
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(raw) || code === 'over_email_send_rate_limit') {
    return t('errors.rateLimit');
  }

  return raw;
}
