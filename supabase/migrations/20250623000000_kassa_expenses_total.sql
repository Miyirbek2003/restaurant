-- Track cash withdrawn from the drawer during a shift (for shortage calculation).

ALTER TABLE cash_register_sessions
  ADD COLUMN IF NOT EXISTS kassa_expenses_total NUMERIC(12,2) NOT NULL DEFAULT 0;
