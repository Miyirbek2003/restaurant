-- Staff invites: add employees without Edge Functions (manager creates code → staff registers at /join)

CREATE TABLE staff_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'WAITER',
  label TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code)
);

CREATE INDEX idx_staff_invites_restaurant ON staff_invites(restaurant_id);
CREATE INDEX idx_staff_invites_code ON staff_invites(upper(code));

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_invites_manager_select ON staff_invites FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

CREATE POLICY staff_invites_manager_insert ON staff_invites FOR INSERT WITH CHECK (
  public.is_manager_or_above() AND restaurant_id = public.user_restaurant_id()
);

CREATE POLICY staff_invites_manager_delete ON staff_invites FOR DELETE USING (
  public.is_manager_or_above() AND restaurant_id = public.user_restaurant_id()
);

-- Preview invite (public, no secrets)
CREATE OR REPLACE FUNCTION public.preview_staff_invite(p_code TEXT)
RETURNS TABLE(restaurant_name TEXT, role user_role, expires_at TIMESTAMPTZ) AS $$
  SELECT r.name, i.role, i.expires_at
  FROM staff_invites i
  JOIN restaurants r ON r.id = i.restaurant_id
  WHERE upper(trim(i.code)) = upper(trim(p_code))
    AND i.used_at IS NULL
    AND i.expires_at > NOW();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.preview_staff_invite(TEXT) TO anon, authenticated;

-- Redeem after signup
CREATE OR REPLACE FUNCTION public.redeem_staff_invite(p_code TEXT, p_user_id UUID DEFAULT auth.uid())
RETURNS JSON AS $$
DECLARE
  inv staff_invites%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO inv FROM staff_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  UPDATE profiles SET
    restaurant_id = inv.restaurant_id,
    role = inv.role,
    status = 'ACTIVE'
  WHERE id = p_user_id;

  UPDATE staff_invites SET used_at = NOW(), used_by = p_user_id WHERE id = inv.id;

  RETURN json_build_object('restaurant_id', inv.restaurant_id, 'role', inv.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.redeem_staff_invite(TEXT, UUID) TO authenticated;
