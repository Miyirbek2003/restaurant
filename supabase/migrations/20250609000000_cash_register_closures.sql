-- End-of-shift cash register (Z) closures
CREATE TABLE cash_register_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  card_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mobile_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  orders_paid_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_register_closures_restaurant_created
  ON cash_register_closures(restaurant_id, created_at DESC);

ALTER TABLE cash_register_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_register_closures_select ON cash_register_closures
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.user_restaurant_id()
  );

CREATE POLICY cash_register_closures_insert ON cash_register_closures
  FOR INSERT WITH CHECK (
    public.is_manager_or_above()
    AND restaurant_id = public.user_restaurant_id()
  );
