-- Category images + public storage bucket for menu uploads

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY menu_images_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

CREATE POLICY menu_images_authenticated_upload ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'menu-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY menu_images_authenticated_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

CREATE POLICY menu_images_authenticated_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
