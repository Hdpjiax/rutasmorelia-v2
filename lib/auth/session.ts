'use client';

import { getBrowserSupabase } from './browser-client';
import { mockSupabaseClient } from '@/lib/supabase/client';

export type SessionUser = { id: string; email: string };

/**
 * Auth unificado: Supabase real (browser) o mock en dev/tests.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const real = getBrowserSupabase();
  if (real) {
    const { data } = await real.auth.getUser();
    if (data.user?.id) {
      return { id: data.user.id, email: data.user.email || '' };
    }
    return null;
  }
  const { data } = await mockSupabaseClient.auth.getUser();
  if (data.user?.id) {
    return { id: data.user.id, email: data.user.email || '' };
  }
  return null;
}

export function onAuthChange(cb: (user: SessionUser | null) => void): () => void {
  const real = getBrowserSupabase();
  if (real) {
    const { data } = real.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      cb(u?.id ? { id: u.id, email: u.email || '' } : null);
    });
    return () => data.subscription.unsubscribe();
  }
  const { data } = mockSupabaseClient.auth.onAuthStateChange((_e, session) => {
    const s = session as { user?: { id: string; email: string } } | null;
    cb(s?.user ? { id: s.user.id, email: s.user.email || '' } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithMagicLink(email: string, redirectTo: string) {
  const real = getBrowserSupabase();
  if (real) {
    return real.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
  }
  return mockSupabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
}

export async function signInWithGoogle(redirectTo: string) {
  const real = getBrowserSupabase();
  if (real) {
    return real.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }
  return mockSupabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
}

export async function signOut() {
  const real = getBrowserSupabase();
  if (real) {
    await real.auth.signOut({ scope: 'local' });
    return;
  }
  await mockSupabaseClient.auth.signOut();
}

/** Cierra sesión en este dispositivo y revoca refresh tokens (otros dispositivos). */
export async function signOutEverywhere() {
  const real = getBrowserSupabase();
  if (real) {
    await real.auth.signOut({ scope: 'global' });
    return;
  }
  await mockSupabaseClient.auth.signOut();
}
