-- One round-trip: reserve stock (if needed) and send order to kitchen.

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

  UPDATE orders
  SET status = 'NEW', sent_to_kitchen_at = COALESCE(sent_to_kitchen_at, NOW()), updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.send_order_to_kitchen(UUID) TO authenticated;
