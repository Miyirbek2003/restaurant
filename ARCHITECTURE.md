# Architecture — Supabase Restaurant POS

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│              React SPA (Vite + TanStack Query)               │
│         @supabase/supabase-js · Auth session · Realtime      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (REST + Realtime + Auth)
┌────────────────────────────▼────────────────────────────────┐
│                      Supabase Platform                         │
│  Auth (JWT) │ PostgREST │ RLS │ Realtime │ Storage (optional)│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    PostgreSQL (tenant data)                    │
└─────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy

- Every business row includes `restaurant_id`.
- `profiles` links `auth.users` to `restaurant_id` and `role`.
- **RLS policies** enforce tenant isolation at the database layer (not only in the client).
- `SUPER_ADMIN` has `restaurant_id = NULL` and policies that allow cross-tenant reads/writes where defined.

## Authentication

1. User signs in via `supabase.auth.signInWithPassword`.
2. JWT is attached automatically to all data requests.
3. `profiles` row is loaded (with `restaurants` join) into `AuthContext`.
4. Session refresh is handled by the Supabase client.

## Authorization (RLS helpers)

| Function | Purpose |
|----------|---------|
| `user_restaurant_id()` | Current user's tenant |
| `user_role()` | Current role enum |
| `is_super_admin()` | Platform operator |
| `is_manager_or_above()` | Manager + Super Admin |
| `can_take_orders()` | Waiter + Manager + Super Admin |
| `can_access_kitchen()` | Kitchen + Manager + Super Admin |

## Realtime

Subscriptions on `orders` and `order_items` (and `tables`) filtered by `restaurant_id` power live kitchen and floor updates without a custom Socket.IO server.

## Order Totals

Database trigger `on_order_item_change` calls `recalculate_order_totals()` when line items change — keeps `subtotal`, `tax_amount`, and `total` consistent.

## Public Menu

Anonymous `SELECT` policies on `restaurants`, `categories`, and `products` when `qr_menu_enabled` and restaurant is `ACTIVE`.

## Why Supabase over custom Express

- Built-in auth, RLS, and realtime reduce operational surface area.
- Security rules live in SQL and apply to all clients (web, mobile, edge functions).
- Scales with Supabase connection pooling and read replicas on higher plans.
