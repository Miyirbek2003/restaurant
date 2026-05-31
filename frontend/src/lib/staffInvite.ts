import { supabase } from '@/lib/supabase';
import type { StaffRole } from '@/hooks/useEmployees';

const PENDING_WAITER_INVITE_KEY = 'pending_waiter_invite';

export type PendingWaiterInvite = {
  code: string;
  name: string;
  phone?: string;
};

export function getJoinUrl(code: string): string {
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}

export function savePendingWaiterInvite(data: PendingWaiterInvite) {
  sessionStorage.setItem(PENDING_WAITER_INVITE_KEY, JSON.stringify(data));
}

export function getPendingWaiterInvite(): PendingWaiterInvite | null {
  const raw = sessionStorage.getItem(PENDING_WAITER_INVITE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingWaiterInvite;
  } catch {
    return null;
  }
}

export function clearPendingWaiterInvite() {
  sessionStorage.removeItem(PENDING_WAITER_INVITE_KEY);
}

export async function completeWaiterInvite(code: string, name: string, phone?: string) {
  const { data, error } = await supabase.rpc('complete_waiter_invite', {
    p_code: code.trim(),
    p_name: name.trim(),
    p_phone: phone?.trim() || null,
  });
  if (error) throw error;
  clearPendingWaiterInvite();
  return data as {
    staff_id?: string;
    restaurant_id?: string;
    role?: StaffRole;
    name?: string;
  } | null;
}

export async function registerStaffFromInvite(code: string, name: string, phone?: string) {
  const { data, error } = await supabase.rpc('register_staff_from_invite', {
    p_code: code.trim(),
    p_name: name.trim(),
    p_phone: phone?.trim() || null,
  });
  if (error) throw error;
  return data as {
    staff_id?: string;
    restaurant_id?: string;
    role?: StaffRole;
    name?: string;
  } | null;
}

export async function fetchMyStaffId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_staff_id');
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function completePendingWaiterInviteIfNeeded(): Promise<boolean> {
  const pending = getPendingWaiterInvite();
  if (!pending) return false;
  await completeWaiterInvite(pending.code, pending.name, pending.phone);
  return true;
}

export function isAlreadyRegisteredError(message: string): boolean {
  return /already registered|already exists|user_already_exists/i.test(message);
}
