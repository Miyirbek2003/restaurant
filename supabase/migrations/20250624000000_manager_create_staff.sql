-- Manager manually adds waiter/cashier: link new auth user to restaurant_staff (no invite / edge function).

CREATE OR REPLACE FUNCTION public.manager_link_new_staff(
  p_user_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_email TEXT
)
RETURNS JSON AS $$
DECLARE
  v_rest UUID := public.user_restaurant_id();
  new_staff_id UUID;
BEGIN
  IF NOT public.is_manager_or_above() OR v_rest IS NULL THEN
    RAISE EXCEPTION 'Only managers can add staff';
  END IF;

  IF length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF NULLIF(trim(p_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;

  IF p_role NOT IN ('WAITER', 'CASHIER') THEN
    RAISE EXCEPTION 'role must be WAITER or CASHIER';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  UPDATE profiles SET
    restaurant_id = v_rest,
    role = p_role::user_role,
    name = trim(p_name),
    phone = NULLIF(trim(p_phone), ''),
    email = NULLIF(trim(p_email), ''),
    status = 'ACTIVE'
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for new user';
  END IF;

  INSERT INTO restaurant_staff (restaurant_id, name, role, phone, email, status, auth_user_id)
  VALUES (
    v_rest,
    trim(p_name),
    p_role::staff_role,
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_email), ''),
    'ACTIVE',
    p_user_id
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = 'ACTIVE'
  RETURNING id INTO new_staff_id;

  RETURN json_build_object(
    'staff_id', new_staff_id,
    'auth_user_id', p_user_id,
    'restaurant_id', v_rest,
    'role', p_role,
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.manager_link_new_staff(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
