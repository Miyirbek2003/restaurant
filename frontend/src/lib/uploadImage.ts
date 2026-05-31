import { supabase } from '@/lib/supabase';

const BUCKET = 'menu-images';

export async function uploadMenuImage(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  const path = `${restaurantId}/${crypto.randomUUID()}.${safeExt}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(
      error.message.includes('Bucket not found')
        ? 'Create Storage bucket "menu-images" in Supabase (public) or paste an image URL instead.'
        : error.message,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
