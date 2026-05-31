import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[RestoPOS] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env',
  );
}

if (supabaseAnonKey?.startsWith('sb_publishable_')) {
  console.warn(
    '[RestoPOS] You are using a publishable key. If the app hangs on load, replace it with the ' +
      'anon public JWT from Supabase → Project Settings → API (starts with eyJ).',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
