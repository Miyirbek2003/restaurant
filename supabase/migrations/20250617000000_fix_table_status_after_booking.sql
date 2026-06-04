-- When a booking is cancelled/no-show (or order discarded), free the table if it has
-- no scheduled booking and no open order — including tables stuck as OCCUPIED.

CREATE OR REPLACE FUNCTION public.sync_table_status_from_bookings(p_table_id UUID)
RETURNS VOID AS $$
DECLARE
  has_scheduled BOOLEAN;
  has_open_order BOOLEAN;
  cur_status table_status;
BEGIN
  IF p_table_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM table_bookings b
    WHERE b.table_id = p_table_id AND b.status = 'SCHEDULED'
  ) INTO has_scheduled;

  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.table_id = p_table_id
      AND o.status IN ('DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED')
  ) INTO has_open_order;

  SELECT status INTO cur_status FROM tables WHERE id = p_table_id;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  IF has_open_order THEN
    IF cur_status IN ('FREE', 'RESERVED') THEN
      UPDATE tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = p_table_id;
    END IF;
    RETURN;
  END IF;

  IF has_scheduled THEN
    IF cur_status IN ('FREE', 'OCCUPIED') THEN
      UPDATE tables SET status = 'RESERVED', updated_at = NOW() WHERE id = p_table_id;
    END IF;
    RETURN;
  END IF;

  IF cur_status IN ('RESERVED', 'OCCUPIED') THEN
    UPDATE tables SET status = 'FREE', updated_at = NOW() WHERE id = p_table_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair tables already stuck after cancelled bookings / discarded orders
UPDATE tables t
SET status = 'FREE', updated_at = NOW()
WHERE t.status IN ('RESERVED', 'OCCUPIED')
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.table_id = t.id
      AND o.status IN ('DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED')
  )
  AND NOT EXISTS (
    SELECT 1 FROM table_bookings b
    WHERE b.table_id = t.id AND b.status = 'SCHEDULED'
  );
