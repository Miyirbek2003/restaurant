import { supabase, createAuthlessClient } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { isAlreadyRegisteredError } from '@/lib/staffInvite';

export async function createRestaurantManager(body: {
  restaurant_id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
}) {
  const { data, error } = await supabase.functions.invoke('admin-platform', {
    body: { action: 'create_manager', ...body },
  });
  if (error) throw error;
  const payload = data as { error?: string; data?: unknown };
  if (payload?.error) throw new Error(payload.error);
  return payload.data;
}

export async function assignExistingManager(
  restaurantId: string,
  email: string,
  name?: string,
) {
  const { data, error } = await supabase.rpc('admin_assign_manager', {
    p_restaurant_id: restaurantId,
    p_email: email.trim(),
    p_name: name?.trim() || null,
  });
  if (error) throw error;
  return data;
}

async function setManagerProfile(
  userId: string,
  restaurantId: string,
  email: string,
  name: string,
) {
  const trimmedEmail = email.trim();

  const { error: directErr } = await supabase
    .from('profiles')
    .update({
      restaurant_id: restaurantId,
      role: 'MANAGER',
      name,
      email: trimmedEmail,
      status: 'ACTIVE',
    })
    .eq('id', userId);

  if (!directErr) return { id: userId };

  const { data, error: rpcErr } = await supabase.rpc('admin_set_manager_profile', {
    p_user_id: userId,
    p_restaurant_id: restaurantId,
    p_name: name,
    p_email: trimmedEmail,
  });
  if (rpcErr) throw rpcErr;
  return data;
}

function isUserNotFoundError(err: unknown): boolean {
  const msg = getErrorMessage(err);
  return /USER_NOT_FOUND|PROFILE_NOT_FOUND|user not found/i.test(msg);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create manager auth account (isolated client — super admin session unchanged). */
async function createManagerAccount(
  restaurantId: string,
  email: string,
  password: string,
  name: string,
) {
  const trimmedEmail = email.trim();
  const authClient = createAuthlessClient();

  const { data, error } = await authClient.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { name, role: 'MANAGER' },
    },
  });

  if (error) {
    if (isAlreadyRegisteredError(error.message)) {
      return assignExistingManager(restaurantId, trimmedEmail, name);
    }
    throw error;
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('MANAGER_EMAIL_CONFIRM_REQUIRED');
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await setManagerProfile(userId, restaurantId, trimmedEmail, name);
    } catch (err) {
      if (attempt === 5 || !/PROFILE_NOT_FOUND|violates|not found/i.test(getErrorMessage(err))) {
        throw err;
      }
      await delay(350);
    }
  }

  throw new Error('PROFILE_NOT_FOUND');
}

/** Create or link a manager using the restaurant contact email as login. */
export async function ensureRestaurantManager(
  restaurantId: string,
  opts: {
    email: string;
    name: string;
    password?: string;
    linkExisting?: boolean;
  },
) {
  const email = opts.email.trim();
  if (!email) return null;

  if (opts.linkExisting) {
    return assignExistingManager(restaurantId, email, opts.name);
  }

  if (!opts.password || opts.password.length < 6) {
    throw new Error('MANAGER_PASSWORD_REQUIRED');
  }

  try {
    return await createManagerAccount(restaurantId, email, opts.password, opts.name);
  } catch (signUpErr) {
    const msg = getErrorMessage(signUpErr);
    if (isAlreadyRegisteredError(msg) || isUserNotFoundError(signUpErr)) {
      try {
        return await assignExistingManager(restaurantId, email, opts.name);
      } catch {
        /* try edge below */
      }
    }

    try {
      return await createRestaurantManager({
        restaurant_id: restaurantId,
        email,
        password: opts.password,
        name: opts.name,
      });
    } catch {
      throw signUpErr;
    }
  }
}
