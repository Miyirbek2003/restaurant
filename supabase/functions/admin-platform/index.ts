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

    const { data: caller, error: profErr } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (profErr || !caller || caller.role !== 'SUPER_ADMIN') {
      return json({ error: 'Only platform admins can use this' }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'create_manager') {
      const { restaurant_id, email, password, name, phone } = body;
      if (!restaurant_id || !email || !password || !name) {
        return json({ error: 'restaurant_id, email, password, and name are required' }, 400);
      }

      const { data: restaurant, error: rErr } = await admin
        .from('restaurants')
        .select('id')
        .eq('id', restaurant_id)
        .single();
      if (rErr || !restaurant) return json({ error: 'Restaurant not found' }, 404);

      const { data: existing } = await admin
        .from('profiles')
        .select('id, role')
        .ilike('email', email.trim())
        .maybeSingle();
      if (existing) {
        if (existing.role === 'SUPER_ADMIN') {
          return json({ error: 'Cannot assign super admin as restaurant manager' }, 400);
        }
        const { error: linkErr } = await admin
          .from('profiles')
          .update({
            restaurant_id,
            role: 'MANAGER',
            name,
            phone: phone ?? null,
            status: 'ACTIVE',
            email: email.trim(),
          })
          .eq('id', existing.id);
        if (linkErr) return json({ error: linkErr.message }, 400);
        return json({
          data: {
            id: existing.id,
            email: email.trim(),
            name,
            role: 'MANAGER',
            linked: true,
          },
        });
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { name, role: 'MANAGER' },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      const { error: updateErr } = await admin
        .from('profiles')
        .update({
          restaurant_id,
          role: 'MANAGER',
          name,
          phone: phone ?? null,
          status: 'ACTIVE',
          email: email.trim(),
        })
        .eq('id', created.user.id);

      if (updateErr) return json({ error: updateErr.message }, 400);

      return json({
        data: {
          id: created.user.id,
          email: email.trim(),
          name,
          role: 'MANAGER',
        },
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
