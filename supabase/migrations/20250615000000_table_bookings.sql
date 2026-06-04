-- Table reservations in advance; booker is a restaurant customer (clients).

CREATE TYPE booking_status AS ENUM ('SCHEDULED', 'ARRIVED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE table_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  party_size INT NOT NULL DEFAULT 2 CHECK (party_size > 0 AND party_size <= 99),
  notes TEXT,
  status booking_status NOT NULL DEFAULT 'SCHEDULED',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_table_bookings_restaurant_time ON table_bookings (restaurant_id, scheduled_at);
CREATE INDEX idx_table_bookings_table ON table_bookings (table_id, status);

-- One active scheduled booking per table
CREATE UNIQUE INDEX ux_table_bookings_scheduled_table
  ON table_bookings (table_id)
  WHERE status = 'SCHEDULED';

CREATE TRIGGER tr_table_bookings_updated
  BEFORE UPDATE ON table_bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_table_booking_refs()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = NEW.customer_id AND c.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'Customer does not belong to this restaurant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM tables t
    WHERE t.id = NEW.table_id AND t.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'Table does not belong to this restaurant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_table_bookings_validate_refs
  BEFORE INSERT OR UPDATE ON table_bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_table_booking_refs();

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
    IF cur_status = 'FREE' OR cur_status = 'RESERVED' THEN
      UPDATE tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = p_table_id;
    END IF;
    RETURN;
  END IF;

  IF has_scheduled THEN
    IF cur_status IN ('FREE', 'RESERVED') THEN
      UPDATE tables SET status = 'RESERVED', updated_at = NOW() WHERE id = p_table_id;
    END IF;
    RETURN;
  END IF;

  IF cur_status IN ('RESERVED', 'OCCUPIED') THEN
    UPDATE tables SET status = 'FREE', updated_at = NOW() WHERE id = p_table_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_table_status_after_booking_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_table_status_from_bookings(OLD.table_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.table_id IS DISTINCT FROM NEW.table_id THEN
    PERFORM public.sync_table_status_from_bookings(OLD.table_id);
    PERFORM public.sync_table_status_from_bookings(NEW.table_id);
    RETURN NEW;
  END IF;

  PERFORM public.sync_table_status_from_bookings(NEW.table_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_table_bookings_sync_table
  AFTER INSERT OR UPDATE OR DELETE ON table_bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_table_status_after_booking_change();

ALTER TABLE table_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_bookings_select ON table_bookings FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

CREATE POLICY table_bookings_write ON table_bookings FOR ALL USING (
  (public.can_take_orders() OR public.is_manager_or_above())
  AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (
  (public.can_take_orders() OR public.is_manager_or_above())
  AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
);

-- Waiters need to pick a client when booking
CREATE POLICY customers_insert_staff ON customers FOR INSERT WITH CHECK (
  public.can_take_orders()
  AND restaurant_id = public.user_restaurant_id()
);
