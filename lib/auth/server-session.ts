/**
 * Sesión server (refresh cookies) para rutas RSC / Route Handlers.
 * Usar con createServerClient de @supabase/ssr cuando haga falta auth en servidor.
 *
 * IMPORTANTE: no importar este módulo desde componentes 'use client'
 * ni desde barrels de cliente (p. ej. features/auth/index). Usar:
 *   import { … } from '@/features/auth/server'
 */

import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // set desde Server Component puede fallar; el middleware refresca sesión
        }
      },
    },
  });
}

export async function getServerSessionUser(): Promise<{ id: string; email: string } | null> {
  const sb = await createSupabaseServerClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user?.id) return null;
  return { id: data.user.id, email: data.user.email || '' };
}
