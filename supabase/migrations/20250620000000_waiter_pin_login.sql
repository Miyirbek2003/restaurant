-- Shared-terminal waiter login: per-staff PIN (bcrypt) + device terminal tokens.
--
-- Model:
--   * A physical device (monoblock) is registered once to a restaurant and gets a
--     long-lived terminal token (stored hashed). This proves "trusted device" without
--     a logged-in user, so the lock screen can list staff and accept PIN logins.
--   * Each waiter/cashier has a 4-6 digit PIN (bcrypt hash on restaurant_staff).
--   * The `waiter-pin-login` Edge Function verifies (terminal token + PIN) via the
--     SECURITY DEFINER functions below, then mints a real Supabase session for that
--     staff member's existing auth user. Existing RLS / staff_id attribution is reused.

-- On Supabase, pgcrypto is installed in the `extensions` schema (not `public`).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── PIN columns on staff ──────────────────────────────────────────────────────
ALTER TABLE restaurant_staff
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- ── Terminal (device) registry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_terminals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_terminals_restaurant
  ON restaurant_terminals(restaurant_id);

ALTER TABLE restaurant_terminals ENABLE ROW LEVEL SECURITY;
-- No permissive SELECT/WRITE policy for authenticated: the token_hash must never be
-- readable from the client. All access goes through the SECURITY DEFINER RPCs below.

-- ── Manager: register a terminal, returns the plaintext token exactly once ──────
CREATE OR REPLACE FUNCTION public.register_terminal(p_label TEXT)
RETURNS JSON AS $$
DECLARE
  v_rest UUID := public.user_restaurant_id();
  v_token TEXT;
  v_id UUID;
BEGIN
  IF NOT public.is_manager_or_above() OR v_rest IS NULL THEN
    RAISE EXCEPTION 'Only managers can register terminals';
  END IF;

  -- 32 hex chars, unguessable
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO restaurant_terminals (restaurant_id, label, token_hash)
  VALUES (v_rest, COALESCE(NULLIF(trim(p_label), ''), 'Terminal'), extensions.crypt(v_token, extensions.gen_salt('bf')))
  RETURNING id INTO v_id;

  RETURN json_build_object('terminal_id', v_id, 'token', v_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
GRANT EXECUTE ON FUNCTION public.register_terminal(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_restaurant_terminals()
RETURNS TABLE(id UUID, label TEXT, is_active BOOLEAN, last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ) AS $$
  SELECT id, label, is_active, last_seen_at, created_at
  FROM restaurant_terminals
  WHERE restaurant_id = public.user_restaurant_id()
    AND public.is_manager_or_above()
  ORDER BY created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.list_restaurant_terminals() TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_terminal(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_rest UUID := public.user_restaurant_id();
BEGIN
  IF NOT public.is_manager_or_above() OR v_rest IS NULL THEN
    RAISE EXCEPTION 'Only managers can revoke terminals';
  END IF;
  UPDATE restaurant_terminals SET is_active = FALSE
  WHERE id = p_id AND restaurant_id = v_rest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.revoke_terminal(UUID) TO authenticated;

-- ── Manager: set / clear a staff PIN ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_rest UUID := public.user_restaurant_id();
BEGIN
  IF NOT public.is_manager_or_above() OR v_rest IS NULL THEN
    RAISE EXCEPTION 'Only managers can set staff PINs';
  END IF;
  IF p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;

  UPDATE restaurant_staff
  SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      pin_set_at = NOW(),
      pin_failed_attempts = 0,
      pin_locked_until = NULL
  WHERE id = p_staff_id
    AND restaurant_id = v_rest;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found in your restaurant';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
GRANT EXECUTE ON FUNCTION public.set_staff_pin(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_staff_pin(p_staff_id UUID)
RETURNS VOID AS $$
DECLARE
  v_rest UUID := public.user_restaurant_id();
BEGIN
  IF NOT public.is_manager_or_above() OR v_rest IS NULL THEN
    RAISE EXCEPTION 'Only managers can clear staff PINs';
  END IF;
  UPDATE restaurant_staff
  SET pin_hash = NULL, pin_set_at = NULL, pin_failed_attempts = 0, pin_locked_until = NULL
  WHERE id = p_staff_id AND restaurant_id = v_rest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.clear_staff_pin(UUID) TO authenticated;

-- ── Service-role only: verify terminal token, returns restaurant_id (or NULL) ────
CREATE OR REPLACE FUNCTION public.verify_terminal_token(p_terminal_id UUID, p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_term restaurant_terminals%ROWTYPE;
BEGIN
  SELECT * INTO v_term FROM restaurant_terminals
  WHERE id = p_terminal_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_term.token_hash <> extensions.crypt(p_token, v_term.token_hash) THEN
    RETURN NULL;
  END IF;
  UPDATE restaurant_terminals SET last_seen_at = NOW() WHERE id = p_terminal_id;
  RETURN v_term.restaurant_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions;
REVOKE ALL ON FUNCTION public.verify_terminal_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_terminal_token(UUID, TEXT) TO service_role;

-- ── Service-role only: verify a staff PIN with brute-force lockout ───────────────
-- Returns { ok, locked, auth_user_id }. Locks for 5 minutes after 5 failed tries.
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id UUID, p_pin TEXT, p_restaurant_id UUID)
RETURNS JSON AS $$
DECLARE
  st restaurant_staff%ROWTYPE;
  v_next_fail INT;
BEGIN
  SELECT * INTO st FROM restaurant_staff
  WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND OR st.status <> 'ACTIVE' OR st.pin_hash IS NULL OR st.auth_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'locked', false);
  END IF;

  IF st.pin_locked_until IS NOT NULL AND st.pin_locked_until > NOW() THEN
    RETURN json_build_object('ok', false, 'locked', true);
  END IF;

  IF st.pin_hash = extensions.crypt(p_pin, st.pin_hash) THEN
    UPDATE restaurant_staff
    SET pin_failed_attempts = 0, pin_locked_until = NULL
    WHERE id = p_staff_id;
    RETURN json_build_object('ok', true, 'locked', false, 'auth_user_id', st.auth_user_id);
  END IF;

  v_next_fail := st.pin_failed_attempts + 1;
  UPDATE restaurant_staff
  SET pin_failed_attempts = v_next_fail,
      pin_locked_until = CASE WHEN v_next_fail >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE pin_locked_until END
  WHERE id = p_staff_id;

  RETURN json_build_object('ok', false, 'locked', v_next_fail >= 5);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions;
REVOKE ALL ON FUNCTION public.verify_staff_pin(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(UUID, TEXT, UUID) TO service_role;
