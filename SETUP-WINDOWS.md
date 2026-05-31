# Windows setup (no Supabase CLI required)

## 1. Database — Supabase Dashboard (SQL Editor)

You do **not** need `supabase db push` on your machine.

1. Open https://supabase.com/dashboard/project/oarsigouovzbkmvedbzw/sql/new
2. Run **in order** (copy each file, paste, click **Run**):
   - `supabase/migrations/20250531000000_initial_schema.sql`
   - `supabase/migrations/20250531000001_settings_rls.sql`
   - `supabase/migrations/20250531000002_inventory_transactions_rls.sql`
   - `supabase/migrations/20250531000003_profiles_manager_update_staff.sql`
   - `supabase/migrations/20250531000004_staff_invites.sql` — staff invite codes
   - `supabase/migrations/20250531000005_restaurant_staff.sql` — waiters & kitchen in `restaurant_staff`
   - `supabase/migrations/20250531000006_waiter_auth_login.sql` — waiter login linked to staff records
   - `supabase/migrations/20250531000007_waiter_tables_stock_alerts.sql` — waiter table status, stock checks, manager alerts
   - `supabase/seed.sql`
3. If you see “already exists” errors, the schema is already applied — skip to seed or user setup.

## 2. Auth settings

1. **Authentication → Providers → Email** → turn off **Confirm email** (for local testing). This avoids confirmation emails and helps stay under send limits.
2. **Authentication → Users → Add user** → create your login (email + password).

### “Email rate limit exceeded”

Supabase limits how many auth emails a project can send per hour (sign-up, reset, confirm). If join/register fails with that message:

1. **Wait** ~30–60 minutes, then try again with a **new email address** (e.g. `waiter2@test.com`).
2. Keep **Confirm email** **off** (step 1 above) so sign-up does not send a message.
3. Optional: **Authentication → Rate limits** (if shown in your dashboard) — relax limits for development only.
4. **Workaround — create staff without the join form:**
   - **Authentication → Users → Add user** (email + password).
   - In SQL Editor (use your invite code from Employees → Invite link):

```sql
-- Replace email and invite code from the manager’s invite
UPDATE profiles
SET restaurant_id = (
    SELECT restaurant_id FROM staff_invites
    WHERE upper(trim(code)) = upper(trim('YOUR_INVITE_CODE'))
      AND used_at IS NULL AND expires_at > NOW()
  ),
  role = (
    SELECT role FROM staff_invites
    WHERE upper(trim(code)) = upper(trim('YOUR_INVITE_CODE'))
      AND used_at IS NULL AND expires_at > NOW()
  ),
  status = 'ACTIVE',
  name = 'Staff Name'
WHERE email = 'waiter@test.com';

UPDATE staff_invites
SET used_at = NOW(), used_by = (SELECT id FROM profiles WHERE email = 'waiter@test.com')
WHERE upper(trim(code)) = upper(trim('YOUR_INVITE_CODE'));
```

Staff can then **Sign in** on the login page (no join form needed).

## 3. Link user to demo restaurant

In SQL Editor, replace the email and run:

```sql
UPDATE profiles
SET restaurant_id = 'a0000000-0000-4000-8000-000000000001',
    role = 'MANAGER'
WHERE email = 'YOUR_EMAIL@example.com';
```

## 4. Frontend `.env`

Already configured in `frontend/.env`:

- `VITE_SUPABASE_URL=https://oarsigouovzbkmvedbzw.supabase.co`
- `VITE_SUPABASE_ANON_KEY=...` (your publishable key)

If login fails, use the **anon public** key from **Project Settings → API** (`eyJhbG...`) instead of the publishable key.

## 5. npm on PowerShell (execution policy)

PowerShell blocks `npm.ps1` by default. Use **one** of these:

### Option A — `npm.cmd` (no policy change)

```powershell
cd D:\Web\restaurant-management\frontend
npm.cmd install
npm.cmd run dev
```

### Option B — Allow scripts for your user (once)

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then:

```powershell
npm install
npm run dev
```

### Option C — Command Prompt (cmd)

```cmd
cd D:\Web\restaurant-management\frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the user you created.

## 6. Optional — install Supabase CLI later

```powershell
npm.cmd install -g supabase
# or: scoop install supabase
```

Then: `supabase login` → `supabase link` → `supabase db push`

## 7. Add waiters & kitchen staff

1. **Staff → Invite link** (role **Waiter**) — share link; waiter registers with **name, email, password** at `/join`.
2. **Staff → Add staff** — add a waiter or kitchen record directly (waiter still needs invite or manual auth setup for login).
3. Turn off **Confirm email** in Auth settings so waiters can sign in immediately after join.

**Waiter flow:** Sign in → **Tables** → tap a free table → **New order** → add items → send to kitchen.

Managers sign in separately and can pick any waiter when creating orders.

## Public menu test

http://localhost:5173/menu/demo-restaurant
