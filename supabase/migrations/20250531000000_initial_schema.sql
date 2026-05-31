-- Restaurant POS SaaS — Multi-tenant schema with RLS

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'MANAGER', 'WAITER', 'KITCHEN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE restaurant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');
CREATE TYPE subscription_plan AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE table_status AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'CLEANING');
CREATE TYPE order_status AS ENUM ('DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'MOBILE', 'OTHER');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE inventory_unit AS ENUM ('KG', 'G', 'LITER', 'ML', 'PIECE');
CREATE TYPE inventory_transaction_type AS ENUM ('PURCHASE', 'USAGE', 'ADJUSTMENT', 'WASTE', 'RETURN');
CREATE TYPE expense_category AS ENUM ('RENT', 'SALARIES', 'UTILITIES', 'INTERNET', 'MARKETING', 'INGREDIENTS', 'CLEANING', 'OTHER');
CREATE TYPE discount_type AS ENUM ('FIXED', 'PERCENTAGE', 'COUPON', 'HAPPY_HOUR', 'VIP');
CREATE TYPE loyalty_transaction_type AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT');

-- ─── Restaurants ─────────────────────────────────────────────────────────────
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  status restaurant_status NOT NULL DEFAULT 'TRIAL',
  subscription_plan subscription_plan NOT NULL DEFAULT 'FREE',
  subscription_ends TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE restaurant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  service_charge_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  loyalty_points_per_dollar NUMERIC(5,2) NOT NULL DEFAULT 1,
  qr_menu_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  receipt_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles extend Supabase Auth users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  salary NUMERIC(12,2),
  hire_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_restaurant ON profiles(restaurant_id);
CREATE INDEX idx_profiles_role ON profiles(restaurant_id, role);

-- ─── Menu ────────────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stock_quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, sku)
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tables & Orders ───────────────────────────────────────────────────────────
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  floor TEXT,
  status table_status NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birthday DATE,
  notes TEXT,
  loyalty_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  waiter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number INT NOT NULL,
  status order_status NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sent_to_kitchen_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, order_number)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL DEFAULT 'CASH',
  status payment_status NOT NULL DEFAULT 'COMPLETED',
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inventory ───────────────────────────────────────────────────────────────
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit inventory_unit NOT NULL DEFAULT 'PIECE',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type inventory_transaction_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Suppliers & Expenses ──────────────────────────────────────────────────────
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category expense_category NOT NULL DEFAULT 'OTHER',
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Loyalty & Discounts ─────────────────────────────────────────────────────
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type loyalty_transaction_type NOT NULL,
  points INT NOT NULL,
  order_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type discount_type NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  coupon_code TEXT,
  min_order_amount NUMERIC(12,2),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, coupon_code)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX idx_products_restaurant ON products(restaurant_id);
CREATE INDEX idx_products_category ON products(restaurant_id, category_id);
CREATE INDEX idx_tables_restaurant_status ON tables(restaurant_id, status);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at);
CREATE INDEX idx_order_items_order ON order_items(restaurant_id, order_id);
CREATE INDEX idx_payments_restaurant_created ON payments(restaurant_id, created_at);
CREATE INDEX idx_expenses_restaurant_date ON expenses(restaurant_id, date);
CREATE INDEX idx_customers_restaurant ON customers(restaurant_id);

-- ─── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_restaurants_updated BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_tables_updated BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Auth helpers (security definer) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('MANAGER', 'SUPER_ADMIN')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_menu()
RETURNS BOOLEAN AS $$
  SELECT public.is_manager_or_above()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_take_orders()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('WAITER', 'MANAGER', 'SUPER_ADMIN')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_access_kitchen()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('KITCHEN', 'MANAGER', 'SUPER_ADMIN')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Order number sequence per restaurant
CREATE OR REPLACE FUNCTION public.next_order_number(p_restaurant_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(MAX(order_number), 0) + 1 FROM orders WHERE restaurant_id = p_restaurant_id
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Recalculate order totals
CREATE OR REPLACE FUNCTION public.recalculate_order_totals(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_tax NUMERIC(12,2);
  v_discount NUMERIC(12,2);
BEGIN
  SELECT
    COALESCE(SUM(oi.unit_price * oi.quantity), 0),
    COALESCE(SUM(oi.unit_price * oi.quantity * oi.tax_rate / 100), 0)
  INTO v_subtotal, v_tax
  FROM order_items oi WHERE oi.order_id = p_order_id;

  SELECT discount_amount INTO v_discount FROM orders WHERE id = p_order_id;

  UPDATE orders SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = GREATEST(v_subtotal + v_tax - COALESCE(v_discount, 0), 0),
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.on_order_item_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalculate_order_totals(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_order_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION public.on_order_item_change();

-- Auto-create profile on signup (default WAITER — admin sets role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'WAITER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Restaurants
CREATE POLICY restaurants_select ON restaurants FOR SELECT USING (
  public.is_super_admin() OR id = public.user_restaurant_id()
);
CREATE POLICY restaurants_insert ON restaurants FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY restaurants_update ON restaurants FOR UPDATE USING (
  public.is_super_admin() OR (public.is_manager_or_above() AND id = public.user_restaurant_id())
);

-- Profiles
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  public.is_super_admin()
  OR restaurant_id = public.user_restaurant_id()
  OR id = auth.uid()
);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (
  public.is_super_admin()
  OR (public.is_manager_or_above() AND restaurant_id = public.user_restaurant_id())
  OR id = auth.uid()
);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (public.is_super_admin() OR public.is_manager_or_above());

-- Tenant-scoped tables (read)
CREATE POLICY tenant_select ON categories FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_products ON products FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_tables ON tables FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_orders ON orders FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_order_items ON order_items FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_customers ON customers FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_inventory ON inventory_items FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_suppliers ON suppliers FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_expenses ON expenses FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_discounts ON discounts FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY tenant_select_payments ON payments FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);

-- Manager write policies (menu, inventory, etc.)
CREATE POLICY manager_categories ON categories FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_products ON products FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_tables ON tables FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_customers ON customers FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_inventory ON inventory_items FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_suppliers ON suppliers FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_expenses ON expenses FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

CREATE POLICY manager_discounts ON discounts FOR ALL USING (
  public.is_manager_or_above() AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
) WITH CHECK (restaurant_id = public.user_restaurant_id() OR public.is_super_admin());

-- Orders: waiters + managers
CREATE POLICY orders_select ON orders FOR SELECT USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
);
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (
  public.can_take_orders() AND restaurant_id = public.user_restaurant_id()
);
CREATE POLICY orders_update ON orders FOR UPDATE USING (
  (public.can_take_orders() OR public.can_access_kitchen())
  AND (restaurant_id = public.user_restaurant_id() OR public.is_super_admin())
);

CREATE POLICY order_items_all ON order_items FOR ALL USING (
  restaurant_id = public.user_restaurant_id() OR public.is_super_admin()
) WITH CHECK (
  public.can_take_orders() AND restaurant_id = public.user_restaurant_id()
);

CREATE POLICY payments_all ON payments FOR ALL USING (
  public.can_take_orders() AND restaurant_id = public.user_restaurant_id()
) WITH CHECK (restaurant_id = public.user_restaurant_id());

-- Public QR menu (anonymous read)
CREATE POLICY public_menu_restaurants ON restaurants FOR SELECT TO anon USING (
  status = 'ACTIVE'
);
CREATE POLICY public_menu_categories ON categories FOR SELECT TO anon USING (
  is_active = TRUE AND EXISTS (
    SELECT 1 FROM restaurants r
    JOIN restaurant_settings rs ON rs.restaurant_id = r.id
    WHERE r.id = categories.restaurant_id AND r.status = 'ACTIVE' AND rs.qr_menu_enabled = TRUE
  )
);
CREATE POLICY public_menu_products ON products FOR SELECT TO anon USING (
  is_active = TRUE AND EXISTS (
    SELECT 1 FROM restaurants r
    JOIN restaurant_settings rs ON rs.restaurant_id = r.id
    WHERE r.id = products.restaurant_id AND r.status = 'ACTIVE' AND rs.qr_menu_enabled = TRUE
  )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
