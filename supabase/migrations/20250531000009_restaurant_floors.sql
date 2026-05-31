-- Custom dining floors per restaurant (Hall, Outdoor, Terrace, …)
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS floors JSONB NOT NULL DEFAULT '["Hall", "Outdoor"]'::jsonb;
