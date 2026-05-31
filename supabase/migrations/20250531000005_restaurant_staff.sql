-- Waiters & kitchen staff live in restaurant_staff (not auth.users / profiles).

CREATE TYPE staff_role AS ENUM ('WAITER', 'KITCHEN');

CREATE TABLE restaurant_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role staff_role NOT NULL,
  phone TEXT,
  email TEXT,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  hire_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurant_staff_restaurant ON restaurant_staff(restaurant_id);
CREATE INDEX idx_restaurant_staff_role ON restaurant_staff(restaurant_id, role);
CREATE INDEX idx_restaurant_staff_status ON restaurant_staff(restaurant_id, status);

CREATE TRIGGER tr_restaurant_staff_updated
  BEFORE UPDATE ON restaurant_staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Orders reference staff table (replaces profiles.waiter_id)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_waiter_id_fkey;
ALTER TABLE orders DROP COLUMN IF EXISTS waiter_id;

-- staff_invites: link to restaurant_staff instead of auth profiles
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL;

ALTER TABLE staff_invites DROP CONSTRAINT IF EXISTS staff_invites_used_by_fkey;
ALTER TABLE staff_invites DROP COLUMN IF EXISTS used_by;

-- RLS
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY restaurant_staff_select ON restaurant_staff FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

CREATE POLICY restaurant_staff_manager_write ON restaurant_staff FOR ALL USING (
  public.is_manager_or_above()
  AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

-- Register staff from invite (no auth account — anon OK)
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

  INSERT INTO restaurant_staff (restaurant_id, name, role, phone, status)
  VALUES (inv.restaurant_id, trim(p_name), inv.role::staff_role, NULLIF(trim(p_phone), ''), 'ACTIVE')
  RETURNING id INTO new_id;

  UPDATE staff_invites
  SET used_at = NOW(), staff_member_id = new_id
  WHERE id = inv.id;

  RETURN json_build_object(
    'staff_id', new_id,
    'restaurant_id', inv.restaurant_id,
    'role', inv.role,
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.register_staff_from_invite(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Replace profile-based redeem (no longer updates auth profiles)
CREATE OR REPLACE FUNCTION public.redeem_staff_invite(p_code TEXT, p_user_id UUID DEFAULT auth.uid())
RETURNS JSON AS $$
BEGIN
  RAISE EXCEPTION 'Staff invites no longer create login accounts. Use register_staff_from_invite with name and invite code on the join page, or add staff from Employees.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
