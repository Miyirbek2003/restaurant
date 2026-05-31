-- Run after creating auth users in Supabase Dashboard (or via Admin API)
-- Demo restaurant + link profiles by updating restaurant_id and role

INSERT INTO restaurants (id, name, slug, email, status, subscription_plan, currency)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Demo Restaurant',
  'demo-restaurant',
  'contact@demo-restaurant.com',
  'ACTIVE',
  'PROFESSIONAL',
  'USD'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO restaurant_settings (restaurant_id, tax_rate, loyalty_points_per_dollar)
VALUES ('a0000000-0000-4000-8000-000000000001', 10, 1)
ON CONFLICT (restaurant_id) DO NOTHING;

INSERT INTO categories (restaurant_id, name, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Drinks', 0),
  ('a0000000-0000-4000-8000-000000000001', 'Food', 1),
  ('a0000000-0000-4000-8000-000000000001', 'Pizza', 2),
  ('a0000000-0000-4000-8000-000000000001', 'Desserts', 3)
ON CONFLICT DO NOTHING;

-- Products (run after categories exist — adjust category ids via subquery)
INSERT INTO products (restaurant_id, category_id, name, sku, price, cost_price, tax_rate, stock_quantity)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  c.id,
  p.name,
  p.sku,
  p.price,
  p.cost,
  10,
  100
FROM (VALUES
  ('Drinks', 'Cola', 'DRK-001', 2.50, 0.80),
  ('Drinks', 'Fanta', 'DRK-002', 2.50, 0.80),
  ('Drinks', 'Sprite', 'DRK-003', 2.50, 0.80),
  ('Food', 'Burger', 'FOD-001', 12.99, 4.50),
  ('Pizza', 'Margherita Pizza', 'PIZ-001', 14.99, 5.00),
  ('Pizza', 'Pepperoni Pizza', 'PIZ-002', 16.99, 5.50)
) AS p(cat, name, sku, price, cost)
JOIN categories c ON c.restaurant_id = 'a0000000-0000-4000-8000-000000000001' AND c.name = p.cat
ON CONFLICT DO NOTHING;

INSERT INTO restaurant_staff (restaurant_id, name, role, status) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Alex Waiter', 'WAITER', 'ACTIVE'),
  ('a0000000-0000-4000-8000-000000000001', 'Chef Maria', 'KITCHEN', 'ACTIVE');

INSERT INTO tables (restaurant_id, name, capacity, floor, status) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'T1', 2, 'Hall', 'FREE'),
  ('a0000000-0000-4000-8000-000000000001', 'T2', 4, 'Hall', 'FREE'),
  ('a0000000-0000-4000-8000-000000000001', 'T3', 4, 'Hall', 'FREE'),
  ('a0000000-0000-4000-8000-000000000001', 'T4', 4, 'Outdoor', 'FREE'),
  ('a0000000-0000-4000-8000-000000000001', 'T5', 6, 'Outdoor', 'FREE'),
  ('a0000000-0000-4000-8000-000000000001', 'T6', 6, 'Outdoor', 'FREE')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (restaurant_id, name, unit, quantity, minimum_quantity, cost_per_unit) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Tomatoes', 'KG', 50, 10, 2),
  ('a0000000-0000-4000-8000-000000000001', 'Mozzarella', 'KG', 20, 5, 8)
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (restaurant_id, name, phone, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Fresh Farms Co', '+1 555 1001', 'orders@freshfarms.com')
ON CONFLICT DO NOTHING;

INSERT INTO expenses (restaurant_id, category, title, amount) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'RENT', 'Monthly Rent', 3500),
  ('a0000000-0000-4000-8000-000000000001', 'UTILITIES', 'Electricity', 450)
ON CONFLICT DO NOTHING;

INSERT INTO customers (restaurant_id, name, phone, loyalty_points) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'John Doe', '+1 555 2001', 120),
  ('a0000000-0000-4000-8000-000000000001', 'Jane Smith', '+1 555 2002', 80)
ON CONFLICT DO NOTHING;

INSERT INTO discounts (restaurant_id, name, type, value, is_active) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Happy Hour 10%', 'PERCENTAGE', 10, TRUE),
  ('a0000000-0000-4000-8000-000000000001', 'VIP $5 Off', 'FIXED', 5, TRUE)
ON CONFLICT DO NOTHING;

-- After creating users in Supabase Auth, run:
-- UPDATE profiles SET restaurant_id = 'a0000000-0000-4000-8000-000000000001', role = 'MANAGER' WHERE email = 'manager@demo.com';
-- UPDATE profiles SET restaurant_id = 'a0000000-0000-4000-8000-000000000001', role = 'WAITER' WHERE email = 'waiter@demo.com';
-- UPDATE profiles SET restaurant_id = 'a0000000-0000-4000-8000-000000000001', role = 'KITCHEN' WHERE email = 'kitchen@demo.com';
-- UPDATE profiles SET role = 'SUPER_ADMIN', restaurant_id = NULL WHERE email = 'admin@platform.com';
