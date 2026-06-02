-- Only opener cashier can close current cash register session
DROP POLICY IF EXISTS cash_register_sessions_update ON cash_register_sessions;

CREATE POLICY cash_register_sessions_update ON cash_register_sessions
  FOR UPDATE USING (
    public.can_operate_cash_register()
    AND restaurant_id = public.user_restaurant_id()
    AND (
      opened_by_profile_id = auth.uid()
      OR (opened_by_staff_id IS NOT NULL AND opened_by_staff_id = public.my_staff_id())
    )
  ) WITH CHECK (
    public.can_operate_cash_register()
    AND restaurant_id = public.user_restaurant_id()
    AND (
      opened_by_profile_id = auth.uid()
      OR (opened_by_staff_id IS NOT NULL AND opened_by_staff_id = public.my_staff_id())
    )
  );

-- Payments: keep read/update/delete behavior, but restrict inserts by session owner
DROP POLICY IF EXISTS payments_all ON payments;

CREATE POLICY payments_select ON payments
  FOR SELECT USING (
    public.can_take_orders()
    AND restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY payments_update ON payments
  FOR UPDATE USING (
    public.can_take_orders()
    AND restaurant_id = public.user_restaurant_id()
  ) WITH CHECK (
    restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY payments_delete ON payments
  FOR DELETE USING (
    public.can_take_orders()
    AND restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY payments_insert_owner_only ON payments
  FOR INSERT WITH CHECK (
    public.can_take_orders()
    AND restaurant_id = public.user_restaurant_id()
    AND cash_register_session_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM cash_register_sessions s
      WHERE s.id = payments.cash_register_session_id
        AND s.restaurant_id = payments.restaurant_id
        AND s.status = 'OPEN'
        AND (
          s.opened_by_profile_id = auth.uid()
          OR (s.opened_by_staff_id IS NOT NULL AND s.opened_by_staff_id = public.my_staff_id())
        )
    )
  );
