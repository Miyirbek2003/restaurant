-- Приход на склад: увеличить остаток и автоматически создать расход (закупка).

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_tx_expense ON inventory_transactions(expense_id);

CREATE OR REPLACE FUNCTION public.record_inventory_purchase(
  p_inventory_item_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  rid UUID := public.user_restaurant_id();
  item RECORD;
  ucost NUMERIC(12,2);
  total NUMERIC(12,2);
  qty_before NUMERIC(12,3);
  qty_after NUMERIC(12,3);
  exp_id UUID;
  tx_id UUID;
  exp_title TEXT;
  exp_notes TEXT;
BEGIN
  IF rid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated for a restaurant';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  SELECT i.id, i.name, i.unit, i.quantity, i.cost_per_unit, i.product_id
  INTO item
  FROM inventory_items i
  WHERE i.id = p_inventory_item_id AND i.restaurant_id = rid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  ucost := ROUND(COALESCE(p_unit_cost, item.cost_per_unit, 0)::NUMERIC, 2);
  IF ucost < 0 THEN
    ucost := 0;
  END IF;

  total := ROUND((p_quantity * ucost)::NUMERIC, 2);
  qty_before := item.quantity;
  qty_after := qty_before + p_quantity;

  exp_title := 'Приход: ' || item.name || ' (' || TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM p_quantity::TEXT)) || ' ' || item.unit::TEXT || ')';
  exp_notes := COALESCE(
    NULLIF(btrim(p_notes), ''),
    'Склад: ' || item.name || ', ' || p_quantity::TEXT || ' ' || item.unit::TEXT || ' × ' || ucost::TEXT
  );

  INSERT INTO expenses (restaurant_id, category, title, amount, date, notes)
  VALUES (rid, 'INGREDIENTS', exp_title, total, COALESCE(p_date, CURRENT_DATE), exp_notes)
  RETURNING id INTO exp_id;

  INSERT INTO inventory_transactions (
    restaurant_id,
    inventory_item_id,
    type,
    quantity,
    cost,
    notes,
    expense_id
  )
  VALUES (
    rid,
    p_inventory_item_id,
    'PURCHASE',
    p_quantity,
    total,
    exp_notes,
    exp_id
  )
  RETURNING id INTO tx_id;

  UPDATE inventory_items
  SET
    quantity = qty_after,
    cost_per_unit = ucost,
    updated_at = NOW()
  WHERE id = p_inventory_item_id AND restaurant_id = rid;

  IF item.product_id IS NOT NULL THEN
    UPDATE products p
    SET
      stock_quantity = GREATEST(0, FLOOR(qty_after)::INT),
      cost_price = ucost,
      updated_at = NOW()
  WHERE p.id = item.product_id AND p.restaurant_id = rid;
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', tx_id,
    'expense_id', exp_id,
    'inventory_item_id', p_inventory_item_id,
    'item_name', item.name,
    'unit', item.unit,
    'quantity_added', p_quantity,
    'unit_cost', ucost,
    'total_cost', total,
    'quantity_before', qty_before,
    'quantity_after', qty_after,
    'expense_title', exp_title,
    'expense_category', 'INGREDIENTS',
    'expense_date', COALESCE(p_date, CURRENT_DATE),
    'expense_amount', total,
    'notes', exp_notes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_inventory_purchase(UUID, NUMERIC, NUMERIC, DATE, TEXT) TO authenticated;
