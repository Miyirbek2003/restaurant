-- Performance indexes for hot read paths (orders, kitchen queue, sessions, bookings).

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_kitchen_time
  ON public.orders (restaurant_id, status, sent_to_kitchen_at);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_restaurant_session_status
  ON public.payments (restaurant_id, cash_register_session_id, status);

CREATE INDEX IF NOT EXISTS idx_table_bookings_restaurant_status_time
  ON public.table_bookings (restaurant_id, status, scheduled_at);
