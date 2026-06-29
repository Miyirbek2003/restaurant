-- When menu product stock is edited, keep linked warehouse quantity in sync.

CREATE OR REPLACE FUNCTION public.trg_products_stock_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  inv_qty NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity THEN
    RETURN NEW;
  END IF;

  inv_qty := GREATEST(
    0,
    CASE WHEN COALESCE(NEW.sale_unit, 'PIECE') = 'KG' THEN NEW.stock_quantity
         ELSE FLOOR(COALESCE(NEW.stock_quantity, 0))
    END
  );

  UPDATE inventory_items i
  SET quantity = inv_qty, updated_at = NOW()
  WHERE i.product_id = NEW.id AND i.restaurant_id = NEW.restaurant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_stock_sync_inventory ON products;
CREATE TRIGGER products_stock_sync_inventory
  AFTER INSERT OR UPDATE OF stock_quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_products_stock_to_inventory();
