-- Super admin: link an existing auth user as restaurant manager by email.

CREATE OR REPLACE FUNCTION public.admin_assign_manager(
  p_restaurant_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND';
  END IF;

  SELECT * INTO target FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF target.role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'CANNOT_ASSIGN_SUPER_ADMIN';
  END IF;

  UPDATE public.profiles
  SET
    restaurant_id = p_restaurant_id,
    role = 'MANAGER',
    status = 'ACTIVE',
    name = COALESCE(NULLIF(trim(p_name), ''), target.name)
  WHERE id = target.id
  RETURNING * INTO target;

  RETURN target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_assign_manager(UUID, TEXT, TEXT) TO authenticated;
