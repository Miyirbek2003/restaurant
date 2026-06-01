-- Warehouse: selling price, menu product link, image, default category for publishing.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN inventory_items.cost_per_unit IS 'Kelish bahosi — purchase cost per unit';
COMMENT ON COLUMN inventory_items.selling_price IS 'Sotish bahosi — selling price per unit';

CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
