-- Public QR menu: work without settings row, allow TRIAL restaurants, single RPC for anon.

DROP POLICY IF EXISTS public_menu_restaurants ON restaurants;
CREATE POLICY public_menu_restaurants ON restaurants FOR SELECT TO anon USING (
  status IN ('ACTIVE', 'TRIAL')
);

DROP POLICY IF EXISTS public_menu_categories ON categories;
CREATE POLICY public_menu_categories ON categories FOR SELECT TO anon USING (
  is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM restaurants r
    LEFT JOIN restaurant_settings rs ON rs.restaurant_id = r.id
    WHERE r.id = categories.restaurant_id
      AND r.status IN ('ACTIVE', 'TRIAL')
      AND COALESCE(rs.qr_menu_enabled, TRUE) = TRUE
  )
);

DROP POLICY IF EXISTS public_menu_products ON products;
CREATE POLICY public_menu_products ON products FOR SELECT TO anon USING (
  is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM restaurants r
    LEFT JOIN restaurant_settings rs ON rs.restaurant_id = r.id
    WHERE r.id = products.restaurant_id
      AND r.status IN ('ACTIVE', 'TRIAL')
      AND COALESCE(rs.qr_menu_enabled, TRUE) = TRUE
  )
);

CREATE OR REPLACE FUNCTION public.get_public_menu(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid UUID;
  result JSONB;
BEGIN
  SELECT r.id INTO rid
  FROM restaurants r
  LEFT JOIN restaurant_settings rs ON rs.restaurant_id = r.id
  WHERE r.slug = trim(p_slug)
    AND r.status IN ('ACTIVE', 'TRIAL')
    AND COALESCE(rs.qr_menu_enabled, TRUE) = TRUE;

  IF rid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'restaurant', (
      SELECT jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'slug', r.slug,
        'logo_url', r.logo_url,
        'currency', r.currency,
        'phone', r.phone,
        'address', r.address
      )
      FROM restaurants r
      WHERE r.id = rid
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(cat ORDER BY cat->>'sort_order', cat->>'name')
      FROM (
        SELECT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'sort_order', c.sort_order,
          'products', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'price', p.price,
                'image_url', p.image_url
              ) ORDER BY p.name
            )
            FROM products p
            WHERE p.category_id = c.id AND p.is_active = TRUE
          ), '[]'::jsonb)
        ) AS cat
        FROM categories c
        WHERE c.restaurant_id = rid AND c.is_active = TRUE
      ) sub
      WHERE jsonb_array_length(sub.cat->'products') > 0
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_menu(TEXT) TO anon, authenticated;
