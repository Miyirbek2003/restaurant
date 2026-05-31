export function getErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : 'An unexpected error occurred';

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  if (code === '42P01' || /staff_invites|restaurant_staff|register_staff_from_invite/i.test(raw)) {
    return 'Database migration missing. Run staff migrations through 20250531000006_waiter_auth_login.sql in Supabase SQL Editor.';
  }
  if (/row-level security/i.test(raw) || code === '42501') {
    return `${raw} — Check that your account has restaurant_id set and role MANAGER (see Employees / Restaurant not assigned card).`;
  }
  if (/Could not find a relationship/i.test(raw)) {
    return `${raw} — Re-run the latest SQL migrations in Supabase.`;
  }
  if (raw === 'INSUFFICIENT_STOCK') {
    return 'Not enough product stock for this order.';
  }
  if (/Insufficient stock/i.test(raw)) {
    return raw;
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(raw) || code === 'over_email_send_rate_limit') {
    return (
      'Supabase blocked sending another auth email (rate limit). For testing: turn off Confirm email in ' +
      'Authentication → Providers → Email, wait about an hour, or create the user in Authentication → Users ' +
      'and link them with your invite code via SQL (see SETUP-WINDOWS.md).'
    );
  }

  return raw;
}
