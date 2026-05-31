ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_select ON restaurant_settings FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

CREATE POLICY settings_manage ON restaurant_settings FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());
