import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: manager, error: profErr } = await admin
      .from('profiles')
      .select('id, role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (profErr || !manager) return json({ error: 'Profile not found' }, 403);
    if (manager.role !== 'MANAGER' || !manager.restaurant_id) {
      return json({ error: 'Only managers can manage staff' }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'create') {
      const { email, name, phone, role = 'WAITER' } = body;
      const trimmedEmail = String(email ?? '').trim();
      const trimmedName = String(name ?? '').trim();
      const trimmedPhone = String(phone ?? '').trim();

      if (!trimmedEmail || !trimmedName || !trimmedPhone) {
        return json({ error: 'email, name, and phone are required' }, 400);
      }
      if (!['WAITER', 'CASHIER'].includes(role)) {
        return json({ error: 'role must be WAITER or CASHIER' }, 400);
      }

      const password = crypto.randomUUID() + crypto.randomUUID();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: trimmedName, role },
      });

      if (createErr) return json({ error: createErr.message }, 400);

      const userId = created.user.id;

      const { error: updateErr } = await admin
        .from('profiles')
        .update({
          restaurant_id: manager.restaurant_id,
          role,
          name: trimmedName,
          phone: trimmedPhone,
          status: 'ACTIVE',
          email: trimmedEmail,
        })
        .eq('id', userId);

      if (updateErr) return json({ error: updateErr.message }, 400);

      const { data: staffRow, error: staffErr } = await admin
        .from('restaurant_staff')
        .insert({
          restaurant_id: manager.restaurant_id,
          name: trimmedName,
          role,
          phone: trimmedPhone,
          email: trimmedEmail,
          status: 'ACTIVE',
          auth_user_id: userId,
        })
        .select('id')
        .single();

      if (staffErr) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: staffErr.message }, 400);
      }

      return json({
        data: {
          id: staffRow.id,
          auth_user_id: userId,
          email: trimmedEmail,
          name: trimmedName,
          role,
          status: 'ACTIVE',
        },
      });
    }

    if (action === 'update_status') {
      const { userId, status } = body;
      if (!userId || !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
        return json({ error: 'Invalid userId or status' }, 400);
      }

      const { data: target } = await admin
        .from('profiles')
        .select('id, restaurant_id, role')
        .eq('id', userId)
        .single();

      if (!target || target.restaurant_id !== manager.restaurant_id) {
        return json({ error: 'Employee not in your restaurant' }, 403);
      }
      if (target.role === 'MANAGER') {
        return json({ error: 'Cannot change manager status' }, 403);
      }

      const { error } = await admin.from('profiles').update({ status }).eq('id', userId);
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ok: true } });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'userId required' }, 400);

      const { data: target } = await admin
        .from('profiles')
        .select('id, restaurant_id, role')
        .eq('id', userId)
        .single();

      if (!target || target.restaurant_id !== manager.restaurant_id) {
        return json({ error: 'Employee not in your restaurant' }, 403);
      }
      if (target.role === 'MANAGER') {
        return json({ error: 'Cannot delete manager' }, 403);
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ data: { ok: true } });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
