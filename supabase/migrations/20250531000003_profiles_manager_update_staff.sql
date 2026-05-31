-- Managers can update staff profiles in their restaurant (block/unblock via status)
CREATE POLICY profiles_manager_update_staff ON profiles
  FOR UPDATE
  USING (
    public.is_manager_or_above()
    AND restaurant_id = public.user_restaurant_id()
    AND role IN ('WAITER', 'KITCHEN')
  )
  WITH CHECK (
    restaurant_id = public.user_restaurant_id()
    AND role IN ('WAITER', 'KITCHEN')
  );
