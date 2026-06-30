import { createClient, type Session } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function corsPreflight() {
  return new Response(null, { status: 204, headers: cors });
}

/** Mint a real Supabase session for an existing auth user (service role only). */
async function mintSessionForEmail(
  email: string,
  supabaseUrl: string,
  serviceKey: string,
  anonKey: string,
): Promise<Session> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

  const props = linkData?.properties;
  if (!props) throw new Error('generateLink: missing properties');

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Current Supabase API returns hashed_token (not always email_otp).
  if (props.hashed_token) {
    for (const otpType of ['email', 'magiclink'] as const) {
      const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
        token_hash: props.hashed_token,
        type: otpType,
      });
      if (!verifyErr && verified?.session) return verified.session;
    }
  }

  if (props.email_otp) {
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      email,
      token: props.email_otp,
      type: 'email',
    });
    if (!verifyErr && verified?.session) return verified.session;
    throw new Error(`verifyOtp: ${verifyErr?.message ?? 'no session'}`);
  }

  throw new Error('generateLink: no hashed_token or email_otp in response');
}

// Shared-terminal waiter login.
//   POST { terminal_id, terminal_token, action: 'login', staff_id, pin }
//     -> { access_token, refresh_token }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflight();
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: 'Server misconfigured (missing Supabase env)' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: 'Invalid body' }, 400);

    const terminalId = String(body.terminal_id ?? '');
    const terminalToken = String(body.terminal_token ?? '');
    const action = String(body.action ?? '');
    if (!terminalId || !terminalToken) {
      return json({ error: 'Missing terminal credentials' }, 401);
    }

    const { data: restaurantId, error: termErr } = await admin.rpc('verify_terminal_token', {
      p_terminal_id: terminalId,
      p_token: terminalToken,
    });
    if (termErr) return json({ error: termErr.message }, 500);
    if (!restaurantId) return json({ error: 'Terminal not recognized' }, 401);

    if (action === 'list') {
      const { data: staff, error } = await admin
        .from('restaurant_staff')
        .select('id, name, role')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ACTIVE')
        .not('pin_hash', 'is', null)
        .order('name', { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ staff: staff ?? [] });
    }

    if (action === 'login') {
      const staffId = String(body.staff_id ?? '');
      const pin = String(body.pin ?? '');
      if (!staffId || !/^[0-9]{4,6}$/.test(pin)) {
        return json({ error: 'Invalid staff or PIN' }, 400);
      }

      const { data: result, error: pinErr } = await admin.rpc('verify_staff_pin', {
        p_staff_id: staffId,
        p_pin: pin,
        p_restaurant_id: restaurantId,
      });
      if (pinErr) return json({ error: pinErr.message }, 500);

      const res = result as { ok: boolean; locked: boolean; auth_user_id?: string };
      if (res?.locked) {
        return json({ error: 'locked', message: 'Too many attempts. Try again in a few minutes.' }, 423);
      }
      if (!res?.ok || !res.auth_user_id) {
        return json({ error: 'invalid_pin' }, 401);
      }

      const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(res.auth_user_id);
      if (userErr || !userRes?.user?.email) {
        return json({ error: 'Account is not set up for login' }, 400);
      }

      let session: Session;
      try {
        session = await mintSessionForEmail(userRes.user.email, supabaseUrl, serviceKey, anonKey);
      } catch (mintErr) {
        const msg = mintErr instanceof Error ? mintErr.message : 'Could not start session';
        console.error('mintSessionForEmail failed:', msg);
        return json({ error: 'session_failed', message: msg }, 500);
      }

      return json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error('waiter-pin-login error:', msg);
    return json({ error: msg }, 500);
  }
});
