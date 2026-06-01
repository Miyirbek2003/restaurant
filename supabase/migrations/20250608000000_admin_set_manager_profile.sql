-- Super admin: attach auth user to restaurant as MANAGER (after signUp).

CREATE OR REPLACE FUNCTION public.admin_set_manager_profile(
  p_user_id UUID,
  p_restaurant_id UUID,
  p_name TEXT,
  p_email TEXT
)
RETURNS public.profiles AS $$
DECLARE
  result public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND';
  END IF;

  UPDATE public.profiles
  SET
    restaurant_id = p_restaurant_id,
    role = 'MANAGER',
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    email = trim(p_email),
    status = 'ACTIVE'
  WHERE id = p_user_id
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_set_manager_profile(UUID, UUID, TEXT, TEXT) TO authenticated;
