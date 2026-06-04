-- Orders: total is meal subtotal minus discount only (no line-item tax).
CREATE OR REPLACE FUNCTION public.recalculate_order_totals(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_discount NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)
  INTO v_subtotal
  FROM order_items oi WHERE oi.order_id = p_order_id;

  SELECT discount_amount INTO v_discount FROM orders WHERE id = p_order_id;

  UPDATE orders SET
    subtotal = v_subtotal,
    tax_amount = 0,
    total = GREATEST(v_subtotal - COALESCE(v_discount, 0), 0),
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-sync existing open orders
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM orders WHERE status NOT IN ('PAID', 'CANCELLED') LOOP
    PERFORM public.recalculate_order_totals(r.id);
  END LOOP;
END $$;
