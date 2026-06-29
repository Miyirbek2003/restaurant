-- Products sold by weight (kg) with fractional order quantities.

DO $$ BEGIN
  CREATE TYPE product_sale_unit AS ENUM ('PIECE', 'KG');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_unit product_sale_unit NOT NULL DEFAULT 'PIECE';

ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE NUMERIC(12, 3) USING stock_quantity::NUMERIC;

ALTER TABLE order_items
  ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::NUMERIC;

ALTER TABLE order_items
  ALTER COLUMN kitchen_qty TYPE NUMERIC(12, 3) USING kitchen_qty::NUMERIC;

ALTER TABLE stock_shortage_alerts
  ALTER COLUMN requested_qty TYPE NUMERIC(12, 3) USING requested_qty::NUMERIC,
  ALTER COLUMN available_qty TYPE NUMERIC(12, 3) USING available_qty::NUMERIC;

-- Return type / arg changes require DROP before CREATE.
DROP FUNCTION IF EXISTS public.report_stock_shortage(UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.report_stock_shortage(UUID, INT, INT);
DROP FUNCTION IF EXISTS public.product_available_stock(UUID);

CREATE OR REPLACE FUNCTION public.product_available_stock(p_product_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  p_stock NUMERIC;
  inv_qty NUMERIC;
  rid UUID := public.user_restaurant_id();
BEGIN
  SELECT p.stock_quantity INTO p_stock FROM products p WHERE p.id = p_product_id AND p.restaurant_id = rid;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT i.quantity INTO inv_qty
  FROM inventory_items i
  WHERE i.product_id = p_product_id AND i.restaurant_id = rid;

  IF NOT FOUND THEN
    RETURN COALESCE(p_stock, 0);
  END IF;

  RETURN LEAST(COALESCE(p_stock, 0), COALESCE(inv_qty, 0));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_linked_product_stock(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  su product_sale_unit;
  inv_qty NUMERIC;
BEGIN
  SELECT sale_unit INTO su FROM products WHERE id = p_product_id AND restaurant_id = rid;

  SELECT i.quantity INTO inv_qty
  FROM inventory_items i
  WHERE i.product_id = p_product_id AND i.restaurant_id = rid;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE products p
  SET
    stock_quantity = GREATEST(0, CASE WHEN su = 'KG' THEN inv_qty ELSE FLOOR(inv_qty) END),
    updated_at = NOW()
  WHERE p.id = p_product_id AND p.restaurant_id = rid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.validate_order_stock(p_items JSONB)
RETURNS JSON AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty NUMERIC;
  avail NUMERIC;
  pname TEXT;
  failures JSONB := '[]'::JSONB;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::NUMERIC;

    SELECT name INTO pname FROM products WHERE id = pid;
    IF NOT FOUND THEN
      failures := failures || jsonb_build_object(
        'product_id', pid, 'product_name', 'Unknown', 'requested', qty, 'available', 0
      );
      CONTINUE;
    END IF;

    avail := public.product_available_stock(pid);

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

CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_items JSONB)
RETURNS VOID AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty NUMERIC;
  avail NUMERIC;
  rid UUID := public.user_restaurant_id();
  has_inv BOOLEAN;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::NUMERIC;

    IF qty <= 0 THEN
      CONTINUE;
    END IF;

    avail := public.product_available_stock(pid);
    IF avail < qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (need %, have %)', pid, qty, avail;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.product_id = pid AND i.restaurant_id = rid
    ) INTO has_inv;

    IF has_inv THEN
      UPDATE inventory_items
      SET quantity = GREATEST(0, quantity - qty), updated_at = NOW()
      WHERE product_id = pid AND restaurant_id = rid;

      PERFORM public.sync_linked_product_stock(pid);
    ELSE
      UPDATE products
      SET stock_quantity = stock_quantity - qty, updated_at = NOW()
      WHERE id = pid
        AND restaurant_id = rid
        AND stock_quantity >= qty;

      IF NOT FOUND THEN
        SELECT stock_quantity INTO avail FROM products WHERE id = pid;
        RAISE EXCEPTION 'Insufficient stock for product % (need %, have %)', pid, qty, COALESCE(avail, 0);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.restore_order_stock(p_items JSONB)
RETURNS VOID AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty NUMERIC;
  rid UUID := public.user_restaurant_id();
  has_inv BOOLEAN;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::NUMERIC;

    IF qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.product_id = pid AND i.restaurant_id = rid
    ) INTO has_inv;

    IF has_inv THEN
      UPDATE inventory_items
      SET quantity = quantity + qty, updated_at = NOW()
      WHERE product_id = pid AND restaurant_id = rid;

      PERFORM public.sync_linked_product_stock(pid);
    ELSE
      UPDATE products
      SET stock_quantity = stock_quantity + qty, updated_at = NOW()
      WHERE id = pid AND restaurant_id = rid;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.report_stock_shortage(
  p_product_id UUID,
  p_requested_qty NUMERIC,
  p_available_qty NUMERIC
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

GRANT EXECUTE ON FUNCTION public.product_available_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_linked_product_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_order_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_order_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_stock_shortage(UUID, NUMERIC, NUMERIC) TO authenticated;
