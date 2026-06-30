-- Bookings: allow several scheduled bookings per table at different times.
-- Previously a single partial unique index (one SCHEDULED row per table) blocked
-- any second booking — even for another day. Replace it with a time-window overlap
-- check: each booking reserves the table for a 4-hour slot, and only overlapping
-- slots on the same table conflict.

DROP INDEX IF EXISTS ux_table_bookings_scheduled_table;

CREATE OR REPLACE FUNCTION public.check_table_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_window INTERVAL := INTERVAL '4 hours';
BEGIN
  IF NEW.status <> 'SCHEDULED' THEN
    RETURN NEW;
  END IF;

  -- Two slots [start, start + 4h) on the same table overlap iff
  -- a.start < b.start + 4h AND b.start < a.start + 4h.
  IF EXISTS (
    SELECT 1 FROM table_bookings b
    WHERE b.table_id = NEW.table_id
      AND b.status = 'SCHEDULED'
      AND b.id <> NEW.id
      AND b.scheduled_at < NEW.scheduled_at + v_window
      AND NEW.scheduled_at < b.scheduled_at + v_window
  ) THEN
    RAISE EXCEPTION 'TABLE_BOOKING_OVERLAP';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_table_bookings_overlap
  BEFORE INSERT OR UPDATE ON table_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_table_booking_overlap();
