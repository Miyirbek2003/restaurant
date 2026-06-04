-- Discard (cancel) an order within 2 minutes of creation; restore stock if deducted.

CREATE OR REPLACE FUNCTION public.discard_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  ord RECORD;
  lines JSONB;
BEGIN
  IF NOT (public.can_take_orders() OR public.is_manager_or_above()) THEN
    RAISE EXCEPTION 'Not allowed to discard orders';
  END IF;

  SELECT id, restaurant_id, status, created_at, stock_deducted, table_id
  INTO ord
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF ord.restaurant_id <> public.user_restaurant_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF ord.status IN ('PAID', 'CANCELLED') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_DISCARD';
  END IF;

  IF ord.created_at < NOW() - INTERVAL '2 minutes' THEN
    RAISE EXCEPTION 'ORDER_DISCARD_WINDOW_EXPIRED';
  END IF;

  IF ord.stock_deducted THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('product_id', oi.product_id, 'quantity', oi.quantity)
      ),
      '[]'::JSONB
    )
    INTO lines
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
      AND oi.quantity > 0;

    IF jsonb_array_length(lines) > 0 THEN
      PERFORM public.restore_order_stock(lines);
    END IF;
  END IF;

  UPDATE orders
  SET status = 'CANCELLED', updated_at = NOW()
  WHERE id = p_order_id;

  IF ord.table_id IS NOT NULL THEN
    PERFORM public.sync_table_status_from_bookings(ord.table_id);

    IF NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.table_id = ord.table_id
        AND o.status IN ('DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED')
    ) AND NOT EXISTS (
      SELECT 1 FROM table_bookings b
      WHERE b.table_id = ord.table_id AND b.status = 'SCHEDULED'
    ) THEN
      UPDATE tables
      SET status = 'FREE', updated_at = NOW()
      WHERE id = ord.table_id
        AND status IN ('OCCUPIED', 'RESERVED');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.discard_order(UUID) TO authenticated;
