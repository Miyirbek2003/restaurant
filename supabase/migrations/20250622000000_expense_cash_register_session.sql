-- Link expenses to an open cash register session when cash was taken from the drawer.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS cash_register_session_id UUID REFERENCES cash_register_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_cash_register_session
  ON expenses(cash_register_session_id)
  WHERE cash_register_session_id IS NOT NULL;

-- Cashiers may record expenses; session link must point to an open shift.
DROP POLICY IF EXISTS cashier_expenses_insert ON expenses;
CREATE POLICY cashier_expenses_insert ON expenses
  FOR INSERT WITH CHECK (
    public.can_operate_cash_register()
    AND restaurant_id = public.user_restaurant_id()
    AND (
      cash_register_session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM cash_register_sessions s
        WHERE s.id = cash_register_session_id
          AND s.restaurant_id = expenses.restaurant_id
          AND s.status = 'OPEN'
      )
    )
  );
