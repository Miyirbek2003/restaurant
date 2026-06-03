-- Waiters may only insert new order lines; they cannot delete or change existing ones.

CREATE OR REPLACE FUNCTION public.order_items_guard_kitchen_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_manager_or_above() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ITEM_IN_KITCHEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'ITEM_IN_KITCHEN';
    END IF;
    IF NEW.kitchen_qty IS DISTINCT FROM OLD.kitchen_qty THEN
      RAISE EXCEPTION 'ITEM_IN_KITCHEN';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
