-- Per-table usage charge (flat or hourly rate)
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS charge_type TEXT NOT NULL DEFAULT 'NONE'
    CHECK (charge_type IN ('NONE', 'HOURLY', 'ONE_TIME')),
  ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
