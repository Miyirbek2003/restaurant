import { createAuthlessClient, supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { isAlreadyRegisteredError } from '@/lib/staffInvite';
import type { StaffRole } from '@/hooks/useEmployees';

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createStaffWithAuth(body: {
  name: string;
  phone: string;
  email: string;
  role: Extract<StaffRole, 'WAITER' | 'CASHIER'>;
}) {
  const name = body.name.trim();
  const phone = body.phone.trim();
  const email = body.email.trim();
  const { role } = body;

  if (!name || !phone || !email) {
    throw new Error('Name, phone, and email are required');
  }

  const authClient = createAuthlessClient();
  const password = randomPassword();

  const { data, error } = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
    },
  });

  if (error) {
    if (isAlreadyRegisteredError(error.message)) {
      throw new Error('EMAIL_ALREADY_REGISTERED');
    }
    throw error;
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('STAFF_EMAIL_CONFIRM_REQUIRED');
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: linked, error: linkErr } = await supabase.rpc('manager_link_new_staff', {
      p_user_id: userId,
      p_name: name,
      p_phone: phone,
      p_role: role,
      p_email: email,
    });

    if (!linkErr) return linked;

    if (attempt === 5 || !/PROFILE_NOT_FOUND|not found|violates/i.test(getErrorMessage(linkErr))) {
      throw linkErr;
    }
    await delay(350);
  }

  throw new Error('PROFILE_NOT_FOUND');
}
