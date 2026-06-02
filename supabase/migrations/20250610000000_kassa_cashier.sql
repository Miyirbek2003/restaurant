-- Cashier role, Click payments, cash register sessions (open/close shift)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'CASHIER'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'CASHIER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'staff_role' AND e.enumlabel = 'CASHIER'
  ) THEN
    ALTER TYPE staff_role ADD VALUE 'CASHIER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'CLICK'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'CLICK';
  END IF;
END $$;

CREATE TYPE cash_register_session_status AS ENUM ('OPEN', 'CLOSED');

-- Replace simple closures with full session lifecycle
DROP TABLE IF EXISTS cash_register_closures;

CREATE TABLE cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status cash_register_session_status NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  opened_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_card NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_click NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_cash NUMERIC(12,2),
  counted_card NUMERIC(12,2),
  counted_click NUMERIC(12,2),
  closing_notes TEXT,
  orders_paid_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX cash_register_one_open_per_restaurant
  ON cash_register_sessions (restaurant_id)
  WHERE status = 'OPEN';

CREATE INDEX idx_cash_register_sessions_restaurant_created
  ON cash_register_sessions(restaurant_id, created_at DESC);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cash_register_session_id UUID REFERENCES cash_register_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(cash_register_session_id);

CREATE OR REPLACE FUNCTION public.can_operate_cash_register()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role::text IN ('MANAGER', 'CASHIER', 'SUPER_ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_operate_cash_register() TO authenticated;

ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_register_sessions_select ON cash_register_sessions
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY cash_register_sessions_insert ON cash_register_sessions
  FOR INSERT WITH CHECK (
    public.can_operate_cash_register()
    AND restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY cash_register_sessions_update ON cash_register_sessions
  FOR UPDATE USING (
    public.can_operate_cash_register()
    AND restaurant_id = public.user_restaurant_id()
  );

CREATE OR REPLACE FUNCTION public.can_operate_cash_register()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role::text IN ('MANAGER', 'CASHIER', 'SUPER_ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_operate_cash_register() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_take_orders()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role::text IN ('WAITER', 'MANAGER', 'SUPER_ADMIN', 'CASHIER')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Auth signup for cashier (same flow as waiter)
CREATE OR REPLACE FUNCTION public.complete_cashier_invite(
  p_code TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  inv staff_invites%ROWTYPE;
  new_staff_id UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT * INTO inv FROM staff_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  IF inv.role::text <> 'CASHIER' THEN
    RAISE EXCEPTION 'This invite is not for a cashier account';
  END IF;

  UPDATE profiles SET
    restaurant_id = inv.restaurant_id,
    role = inv.role,
    name = trim(p_name),
    phone = NULLIF(trim(p_phone), ''),
    status = 'ACTIVE'
  WHERE id = uid;

  INSERT INTO restaurant_staff (restaurant_id, name, role, phone, status, auth_user_id)
  VALUES (inv.restaurant_id, trim(p_name), inv.role::text::staff_role, NULLIF(trim(p_phone), ''), 'ACTIVE', uid)
  ON CONFLICT (auth_user_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    status = 'ACTIVE'
  RETURNING id INTO new_staff_id;

  UPDATE staff_invites SET used_at = NOW(), staff_member_id = new_staff_id WHERE id = inv.id;

  RETURN json_build_object(
    'staff_id', new_staff_id,
    'restaurant_id', inv.restaurant_id,
    'role', inv.role::text,
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.complete_cashier_invite(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_staff_from_invite(
  p_code TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  inv staff_invites%ROWTYPE;
  new_id UUID;
BEGIN
  IF length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT * INTO inv FROM staff_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  IF inv.role::text IN ('WAITER', 'CASHIER') THEN
    RAISE EXCEPTION 'This role needs email signup on the join page (name, email, password)';
  END IF;

  INSERT INTO restaurant_staff (restaurant_id, name, role, phone, status)
  VALUES (inv.restaurant_id, trim(p_name), inv.role::staff_role, NULLIF(trim(p_phone), ''), 'ACTIVE')
  RETURNING id INTO new_id;

  UPDATE staff_invites SET used_at = NOW(), staff_member_id = new_id WHERE id = inv.id;

  RETURN json_build_object(
    'staff_id', new_id,
    'restaurant_id', inv.restaurant_id,
    'role', inv.role,
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.register_staff_from_invite(TEXT, TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS profiles_manager_update_staff ON profiles;
CREATE POLICY profiles_manager_update_staff ON profiles
  FOR UPDATE
  USING (
    public.is_manager_or_above()
    AND restaurant_id = public.user_restaurant_id()
    AND role::text IN ('WAITER', 'KITCHEN', 'CASHIER')
  )
  WITH CHECK (
    restaurant_id = public.user_restaurant_id()
    AND role::text IN ('WAITER', 'KITCHEN', 'CASHIER')
  );
