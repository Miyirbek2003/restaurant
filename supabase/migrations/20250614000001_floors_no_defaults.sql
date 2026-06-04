-- No preset floors; restaurants add their own via Столы.
ALTER TABLE restaurant_settings
  ALTER COLUMN floors SET DEFAULT '[]'::jsonb;

UPDATE restaurant_settings
SET floors = '[]'::jsonb
WHERE floors = '["Hall", "Outdoor"]'::jsonb;
