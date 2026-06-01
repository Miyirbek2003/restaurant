-- Return product stock when order lines are removed or quantities reduced after kitchen send.

CREATE OR REPLACE FUNCTION public.restore_order_stock(p_items JSONB)
RETURNS VOID AS $$
DECLARE
  line JSONB;
  pid UUID;
  qty INT;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    pid := (line->>'product_id')::UUID;
    qty := (line->>'quantity')::INT;

    IF qty <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE products
    SET stock_quantity = stock_quantity + qty,
        updated_at = NOW()
    WHERE id = pid
      AND restaurant_id = public.user_restaurant_id();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.restore_order_stock(JSONB) TO authenticated;
