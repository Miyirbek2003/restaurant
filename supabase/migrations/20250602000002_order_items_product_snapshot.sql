-- Keep order history when menu products are fully deleted.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT;

UPDATE order_items oi
SET product_name = p.name
FROM products p
WHERE oi.product_id = p.id
  AND (oi.product_name IS NULL OR btrim(oi.product_name) = '');

UPDATE order_items
SET product_name = 'Unknown'
WHERE product_name IS NULL OR btrim(product_name) = '';

ALTER TABLE order_items
  ALTER COLUMN product_name SET NOT NULL,
  ALTER COLUMN product_name SET DEFAULT 'Unknown';

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.order_items_set_product_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND (NEW.product_name IS NULL OR btrim(NEW.product_name) = '') THEN
    SELECT name INTO NEW.product_name FROM products WHERE id = NEW.product_id;
  END IF;
  NEW.product_name := COALESCE(NULLIF(btrim(NEW.product_name), ''), 'Unknown');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_order_items_product_name ON order_items;

CREATE TRIGGER tr_order_items_product_name
  BEFORE INSERT OR UPDATE OF product_id, product_name ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_set_product_name();

-- Fully remove menu product (detach order lines, then delete).
CREATE OR REPLACE FUNCTION public.remove_menu_product(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  pname TEXT;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  SELECT name INTO pname FROM products WHERE id = p_product_id AND restaurant_id = rid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  UPDATE order_items oi
  SET
    product_name = COALESCE(NULLIF(btrim(oi.product_name), ''), pname),
    product_id = NULL,
    updated_at = NOW()
  WHERE oi.product_id = p_product_id AND oi.restaurant_id = rid;

  UPDATE inventory_items
  SET product_id = NULL, updated_at = NOW()
  WHERE product_id = p_product_id AND restaurant_id = rid;

  DELETE FROM products WHERE id = p_product_id AND restaurant_id = rid;

  RETURN jsonb_build_object('action', 'deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fully remove category and all dishes in it.
CREATE OR REPLACE FUNCTION public.remove_menu_category(p_category_id UUID)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  prod_id UUID;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM categories WHERE id = p_category_id AND restaurant_id = rid
  ) THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  FOR prod_id IN
    SELECT id FROM products WHERE category_id = p_category_id AND restaurant_id = rid
  LOOP
    PERFORM public.remove_menu_product(prod_id);
  END LOOP;

  DELETE FROM categories WHERE id = p_category_id AND restaurant_id = rid;

  RETURN jsonb_build_object('action', 'deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.remove_menu_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_menu_category(UUID) TO authenticated;
