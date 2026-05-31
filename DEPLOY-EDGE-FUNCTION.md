# Deploy `manage-employee` (optional)

**Recommended:** use **Employees → Invite link** and have staff register at `/join` — no Edge Function. Run migration `20250531000004_staff_invites.sql` in the SQL Editor.

Deploy this function only if you want **Employees → Create login** (manager enters email/password and the account is created immediately).

## Steps

1. Install Supabase CLI (optional): `npm.cmd install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref oarsigouovzbkmvedbzw`
4. Deploy:

```bash
cd D:\Web\restaurant-management
supabase functions deploy manage-employee
```

Or in **Supabase Dashboard** → **Edge Functions** → create function `manage-employee` and paste code from `supabase/functions/manage-employee/index.ts`.

## Secrets (auto in hosted Supabase)

The function uses:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project Settings → API → service_role)
- `SUPABASE_ANON_KEY`

These are set automatically when deployed via Supabase CLI.

## Test

As manager → **Employees** → **Add employee** → fill email/password → **Create account**.

The new user can sign in immediately (email confirmation should be off in Auth settings).
