-- Safe menu removal: hide from menu when order history exists; hard-delete when possible.

CREATE OR REPLACE FUNCTION public.remove_menu_product(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  used_in_orders BOOLEAN;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = p_product_id AND restaurant_id = rid
  ) THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  UPDATE inventory_items
  SET product_id = NULL, updated_at = NOW()
  WHERE product_id = p_product_id AND restaurant_id = rid;

  SELECT EXISTS (
    SELECT 1 FROM order_items WHERE product_id = p_product_id AND restaurant_id = rid
  ) INTO used_in_orders;

  IF used_in_orders THEN
    UPDATE products
    SET is_active = false, updated_at = NOW()
    WHERE id = p_product_id AND restaurant_id = rid;

    RETURN jsonb_build_object('action', 'archived');
  END IF;

  DELETE FROM products WHERE id = p_product_id AND restaurant_id = rid;

  RETURN jsonb_build_object('action', 'deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.remove_menu_category(p_category_id UUID)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  prod_id UUID;
  remaining INT;
  result JSONB;
  any_archived BOOLEAN := false;
  all_deleted BOOLEAN := true;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM categories WHERE id = p_category_id AND restaurant_id = rid
  ) THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  SELECT COUNT(*)::INT INTO remaining
  FROM products WHERE category_id = p_category_id AND restaurant_id = rid;

  IF remaining = 0 THEN
    DELETE FROM categories WHERE id = p_category_id AND restaurant_id = rid;
    RETURN jsonb_build_object('action', 'deleted');
  END IF;

  FOR prod_id IN
    SELECT id FROM products WHERE category_id = p_category_id AND restaurant_id = rid
  LOOP
    result := public.remove_menu_product(prod_id);
    IF result->>'action' = 'archived' THEN
      any_archived := true;
      all_deleted := false;
    ELSIF result->>'action' <> 'deleted' THEN
      all_deleted := false;
    END IF;
  END LOOP;

  SELECT COUNT(*)::INT INTO remaining
  FROM products WHERE category_id = p_category_id AND restaurant_id = rid;

  IF remaining > 0 THEN
    UPDATE categories
    SET is_active = false, updated_at = NOW()
    WHERE id = p_category_id AND restaurant_id = rid;

    RETURN jsonb_build_object(
      'action', 'archived',
      'products_remaining', remaining
    );
  END IF;

  DELETE FROM categories WHERE id = p_category_id AND restaurant_id = rid;

  IF any_archived THEN
    RETURN jsonb_build_object('action', 'deleted');
  END IF;

  RETURN jsonb_build_object('action', 'deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.remove_menu_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_menu_category(UUID) TO authenticated;
