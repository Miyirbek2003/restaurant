-- Link salary expenses to staff members.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_staff ON expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(restaurant_id, date);
