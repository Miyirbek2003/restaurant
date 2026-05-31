ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY manager_inventory_tx ON inventory_transactions FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());
