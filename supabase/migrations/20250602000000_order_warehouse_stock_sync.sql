-- Link order stock to warehouse (inventory_items) and track when stock was reserved.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.stock_deducted IS 'True after order lines were deducted from product/warehouse stock';

-- Effective sellable quantity: min(menu product stock, linked warehouse qty)
CREATE OR REPLACE FUNCTION public.product_available_stock(p_product_id UUID)
RETURNS INT AS $$
DECLARE
  p_stock INT;
  inv_qty INT;
  rid UUID := public.user_restaurant_id();
BEGIN
  SELECT p.stock_quantity INTO p_stock FROM products p WHERE p.id = p_product_id AND p.restaurant_id = rid;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT FLOOR(i.quantity)::INT INTO inv_qty
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
BEGIN
  UPDATE products p
  SET
    stock_quantity = GREATEST(
      0,
      COALESCE(
        (SELECT FLOOR(i.quantity)::INT
         FROM inventory_items i
         WHERE i.product_id = p.id AND i.restaurant_id = rid),
        p.stock_quantity
      )
    ),
    updated_at = NOW()
  WHERE p.id = p_product_id AND p.restaurant_id = rid
    AND EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.product_id = p.id AND i.restaurant_id = rid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  qty INT;
  avail INT;
  rid UUID := public.user_restaurant_id();
  has_inv BOOLEAN;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::INT;

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
  qty INT;
  rid UUID := public.user_restaurant_id();
  has_inv BOOLEAN;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::INT;

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

GRANT EXECUTE ON FUNCTION public.product_available_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_linked_product_stock(UUID) TO authenticated;
