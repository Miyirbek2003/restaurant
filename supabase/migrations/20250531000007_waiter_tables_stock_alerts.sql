-- Waiters can update table status; stock checks; manager shortage alerts.

CREATE POLICY staff_tables_update ON tables FOR UPDATE
  USING (
    public.can_take_orders()
    AND restaurant_id = public.user_restaurant_id()
  )
  WITH CHECK (restaurant_id = public.user_restaurant_id());

CREATE OR REPLACE FUNCTION public.update_table_status(p_table_id UUID, p_status table_status)
RETURNS VOID AS $$
BEGIN
  IF NOT (public.can_take_orders() OR public.is_manager_or_above()) THEN
    RAISE EXCEPTION 'Not allowed to update tables';
  END IF;

  UPDATE tables
  SET status = p_status, updated_at = NOW()
  WHERE id = p_table_id
    AND restaurant_id = public.user_restaurant_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found or access denied';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_table_status(UUID, table_status) TO authenticated;

-- Manager alerts when waiter requests more than available stock (products.stock_quantity)
CREATE TABLE stock_shortage_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  requested_qty INT NOT NULL,
  available_qty INT NOT NULL,
  staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL,
  staff_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_stock_alerts_restaurant ON stock_shortage_alerts(restaurant_id, acknowledged_at);

ALTER TABLE stock_shortage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_alerts_select ON stock_shortage_alerts FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

CREATE POLICY stock_alerts_manager_update ON stock_shortage_alerts FOR UPDATE USING (
  public.is_manager_or_above() AND restaurant_id = public.user_restaurant_id()
);

CREATE OR REPLACE FUNCTION public.report_stock_shortage(
  p_product_id UUID,
  p_requested_qty INT,
  p_available_qty INT
)
RETURNS UUID AS $$
DECLARE
  p RECORD;
  sid UUID;
  sname TEXT;
  alert_id UUID;
BEGIN
  SELECT id, name, stock_quantity, restaurant_id INTO p
  FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF p.restaurant_id <> public.user_restaurant_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id, name INTO sid, sname FROM restaurant_staff
  WHERE auth_user_id = auth.uid() LIMIT 1;

  INSERT INTO stock_shortage_alerts (
    restaurant_id, product_id, product_name, requested_qty, available_qty, staff_id, staff_name
  ) VALUES (
    p.restaurant_id, p.id, p.name, p_requested_qty, p_available_qty, sid, sname
  )
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.report_stock_shortage(UUID, INT, INT) TO authenticated;

-- Validate cart lines against product stock (track_stock = stock_quantity >= 0 and enforced when quantity column used)
CREATE OR REPLACE FUNCTION public.validate_order_stock(p_items JSONB)
RETURNS JSON AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty INT;
  avail INT;
  pname TEXT;
  failures JSONB := '[]'::JSONB;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::INT;

    SELECT stock_quantity, name INTO avail, pname FROM products WHERE id = pid;

    IF NOT FOUND THEN
      failures := failures || jsonb_build_object(
        'product_id', pid, 'product_name', 'Unknown', 'requested', qty, 'available', 0
      );
      CONTINUE;
    END IF;

    IF avail < qty THEN
      failures := failures || jsonb_build_object(
        'product_id', pid, 'product_name', pname, 'requested', qty, 'available', avail
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(failures) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'failures', failures);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.validate_order_stock(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_items JSONB)
RETURNS VOID AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty INT;
  avail INT;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::INT;

    UPDATE products
    SET stock_quantity = stock_quantity - qty,
        updated_at = NOW()
    WHERE id = pid
      AND restaurant_id = public.user_restaurant_id()
      AND stock_quantity >= qty;

    IF NOT FOUND THEN
      SELECT stock_quantity INTO avail FROM products WHERE id = pid;
      RAISE EXCEPTION 'Insufficient stock for product % (need %, have %)', pid, qty, COALESCE(avail, 0);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.deduct_order_stock(JSONB) TO authenticated;
