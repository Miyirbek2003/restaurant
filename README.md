# Restaurant POS SaaS (Supabase)

Multi-tenant restaurant management platform with **Supabase Auth**, **PostgreSQL**, **Row Level Security**, and a **React** dashboard.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Data fetching | TanStack React Query |
| State | Zustand (theme, notifications) |
| Backend | Supabase (Auth + Database + Realtime) |
| Charts | Recharts |

## Features

- Multi-tenant isolation via `restaurant_id` + RLS
- Roles: `SUPER_ADMIN`, `MANAGER`, `WAITER`, `KITCHEN`
- Menu (categories, products), tables, orders, kitchen display
- Inventory, suppliers, expenses, customers, discounts, employees
- Dashboard analytics, platform admin views
- Public QR menu (`/menu/:slug`)
- Realtime order & table updates (Supabase Realtime)

## Project Structure

```
restaurant-management/
├── supabase/
│   ├── migrations/     # SQL schema + RLS
│   ├── seed.sql        # Demo restaurant data
│   └── config.toml     # Local Supabase config
└── frontend/           # React SPA
```

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Copy **Project URL** and **anon public key**.

### 2. Run migrations

**Option A — Supabase CLI (recommended)**

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B — SQL Editor**

Run the contents of `supabase/migrations/20250531000000_initial_schema.sql` and `20250531000001_settings_rls.sql` in the Supabase SQL Editor, then run `supabase/seed.sql`.

### 3. Configure frontend

```bash
cd frontend
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm install
npm run dev
```

App: http://localhost:5173

### 4. Create users

1. In Supabase Dashboard → **Authentication** → **Users**, create users (e.g. `manager@demo.com`).
2. Profiles are auto-created via trigger on signup.
3. Link users to the demo restaurant:

```sql
UPDATE profiles
SET restaurant_id = 'a0000000-0000-4000-8000-000000000001', role = 'MANAGER'
WHERE email = 'manager@demo.com';

UPDATE profiles SET role = 'WAITER', restaurant_id = 'a0000000-0000-4000-8000-000000000001' WHERE email = 'waiter@demo.com';
UPDATE profiles SET role = 'KITCHEN', restaurant_id = 'a0000000-0000-4000-8000-000000000001' WHERE email = 'kitchen@demo.com';
UPDATE profiles SET role = 'SUPER_ADMIN', restaurant_id = NULL WHERE email = 'admin@platform.com';
```

Disable email confirmation in **Auth → Providers → Email** for faster local testing.

## RBAC (enforced in RLS)

| Module | SUPER_ADMIN | MANAGER | WAITER | KITCHEN |
|--------|:-----------:|:-------:|:------:|:-------:|
| Restaurants (all) | ✓ | — | — | — |
| Menu CRUD | ✓ | ✓ | read | — |
| Orders | ✓ | ✓ | ✓ | status |
| Kitchen queue | ✓ | ✓ | — | ✓ |
| Expenses / inventory | ✓ | ✓ | — | — |

## Public QR Menu

After seeding, open: `http://localhost:5173/menu/demo-restaurant`

Managers can generate a QR code from **QR Menu** in the sidebar.

## Generate TypeScript types

```bash
cd frontend
supabase gen types typescript --project-id YOUR_REF > src/types/database.ts
```

## Documentation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for tenancy and security design.
