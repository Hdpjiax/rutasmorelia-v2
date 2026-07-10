'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Cliente browser real (anon key) con cookies PKCE.
 * Debe usar @supabase/ssr para que middleware.ts vea la sesión
 * al proteger /admin y /api/qa.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return browserClient;
}
