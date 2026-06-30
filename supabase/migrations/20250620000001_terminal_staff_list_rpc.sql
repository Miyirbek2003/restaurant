-- List staff for a bound terminal device (anon-safe: terminal token is the credential).
-- Avoids calling the edge function just to populate the lock screen.

CREATE OR REPLACE FUNCTION public.list_terminal_staff_for_device(p_terminal_id UUID, p_token TEXT)
RETURNS TABLE(id UUID, name TEXT, role TEXT) AS $$
DECLARE
  v_term restaurant_terminals%ROWTYPE;
BEGIN
  SELECT * INTO v_term FROM restaurant_terminals rt
  WHERE rt.id = p_terminal_id AND rt.is_active = TRUE;
  IF NOT FOUND OR v_term.token_hash <> extensions.crypt(p_token, v_term.token_hash) THEN
    RAISE EXCEPTION 'Terminal not recognized';
  END IF;

  UPDATE restaurant_terminals rt SET last_seen_at = NOW() WHERE rt.id = p_terminal_id;

  RETURN QUERY
  SELECT rs.id, rs.name, rs.role::text
  FROM restaurant_staff rs
  WHERE rs.restaurant_id = v_term.restaurant_id
    AND rs.status = 'ACTIVE'
    AND rs.pin_hash IS NOT NULL
  ORDER BY rs.name;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.list_terminal_staff_for_device(UUID, TEXT) TO anon, authenticated;
