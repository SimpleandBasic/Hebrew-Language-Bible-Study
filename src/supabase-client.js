import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdminClient(env = process.env) {
  const url = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing HEBREW_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing HEBREW_SUPABASE_SERVICE_ROLE_KEY. This key must stay server-side only.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
