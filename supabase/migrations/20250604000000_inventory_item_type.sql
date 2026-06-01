-- Kitchen (not for sale) vs sale warehouse items.

CREATE TYPE inventory_item_type AS ENUM ('KITCHEN', 'SALE');

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS item_type inventory_item_type NOT NULL DEFAULT 'KITCHEN';

UPDATE inventory_items
SET item_type = 'SALE'
WHERE product_id IS NOT NULL OR COALESCE(selling_price, 0) > 0;

COMMENT ON COLUMN inventory_items.item_type IS 'KITCHEN = кухня (не продаётся), SALE = для продажи / меню';
