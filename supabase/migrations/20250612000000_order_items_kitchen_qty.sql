-- Track quantity already sent to kitchen; waiters cannot remove or reduce below this.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS kitchen_qty INT NOT NULL DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_kitchen_qty_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_kitchen_qty_check
  CHECK (kitchen_qty >= 0 AND kitchen_qty <= quantity);

-- Backfill: lines that existed when the order was first sent to kitchen.
UPDATE order_items oi
SET kitchen_qty = oi.quantity
FROM orders o
WHERE oi.order_id = o.id
  AND o.sent_to_kitchen_at IS NOT NULL
  AND oi.created_at <= o.sent_to_kitchen_at + interval '2 seconds';

CREATE OR REPLACE FUNCTION public.order_items_guard_kitchen_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_manager_or_above() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ITEM_IN_KITCHEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'ITEM_IN_KITCHEN';
    END IF;
    IF NEW.kitchen_qty IS DISTINCT FROM OLD.kitchen_qty THEN
      RAISE EXCEPTION 'ITEM_IN_KITCHEN';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_order_items_kitchen_qty ON order_items;

CREATE TRIGGER tr_order_items_kitchen_qty
  BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_guard_kitchen_qty();

-- Mark all current lines as in-kitchen when order is sent.
CREATE OR REPLACE FUNCTION public.send_order_to_kitchen(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  ord RECORD;
  lines JSONB := '[]'::JSONB;
  line RECORD;
  failures JSON;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  SELECT id, stock_deducted, status
  INTO ord
  FROM orders
  WHERE id = p_order_id AND restaurant_id = rid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF ord.status NOT IN ('DRAFT', 'NEW') THEN
    RAISE EXCEPTION 'ORDER_NOT_EDITABLE';
  END IF;

  IF NOT ord.stock_deducted THEN
    FOR line IN
      SELECT oi.product_id, SUM(oi.quantity)::INT AS quantity
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.restaurant_id = rid
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
    LOOP
      lines := lines || jsonb_build_object('product_id', line.product_id, 'quantity', line.quantity);
    END LOOP;

    IF jsonb_array_length(lines) > 0 THEN
      failures := public.validate_order_stock(lines);
      IF (failures->>'ok')::BOOLEAN IS NOT TRUE THEN
        RETURN failures;
      END IF;
      PERFORM public.deduct_order_stock(lines);
    END IF;

    UPDATE orders SET stock_deducted = true, updated_at = NOW() WHERE id = p_order_id;
  END IF;

  UPDATE order_items
  SET kitchen_qty = quantity, updated_at = NOW()
  WHERE order_id = p_order_id AND restaurant_id = rid;

  UPDATE orders
  SET status = 'NEW', sent_to_kitchen_at = COALESCE(sent_to_kitchen_at, NOW()), updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.send_order_to_kitchen(UUID) TO authenticated;
