-- Waiters log in (auth.users + profiles) and link to restaurant_staff for orders.

ALTER TABLE restaurant_staff
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_staff_auth_user ON restaurant_staff(auth_user_id);

CREATE POLICY restaurant_staff_self_select ON restaurant_staff FOR SELECT USING (
  auth_user_id = auth.uid()
);

-- After signUp: link profile + restaurant_staff (authenticated only)
CREATE OR REPLACE FUNCTION public.complete_waiter_invite(
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

  IF inv.role::text <> 'WAITER' THEN
    RAISE EXCEPTION 'This invite is not for a waiter account';
  END IF;

  UPDATE profiles SET
    restaurant_id = inv.restaurant_id,
    role = 'WAITER',
    name = trim(p_name),
    phone = NULLIF(trim(p_phone), ''),
    status = 'ACTIVE'
  WHERE id = uid;

  INSERT INTO restaurant_staff (restaurant_id, name, role, phone, status, auth_user_id)
  VALUES (inv.restaurant_id, trim(p_name), 'WAITER', NULLIF(trim(p_phone), ''), 'ACTIVE', uid)
  ON CONFLICT (auth_user_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    role = 'WAITER',
    status = 'ACTIVE'
  RETURNING id INTO new_staff_id;

  UPDATE staff_invites SET used_at = NOW(), staff_member_id = new_staff_id WHERE id = inv.id;

  RETURN json_build_object(
    'staff_id', new_staff_id,
    'restaurant_id', inv.restaurant_id,
    'role', 'WAITER',
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.complete_waiter_invite(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_staff_id()
RETURNS UUID AS $$
  SELECT id FROM restaurant_staff
  WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.my_staff_id() TO authenticated;

-- Kitchen (and non-login roles): name-only registration
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

  IF inv.role::text = 'WAITER' THEN
    RAISE EXCEPTION 'Waiter invites need email signup on the join page (name, email, password)';
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
