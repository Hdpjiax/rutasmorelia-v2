'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';
import {
  getSessionUser,
  isAdminEmail,
  onAuthChange,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
  type SessionUser,
} from '@/features/auth';

/**
 * Formulario de acceso admin: magic link + Google.
 * Tras autenticar, redirige a /admin/qa si el correo está en ADMIN_EMAILS.
 */
export function AdminLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(true);

  const redirectIfAdmin = useCallback(
    async (u: SessionUser | null) => {
      if (!u?.email) return;
      // En cliente solo hay NEXT_PUBLIC_ADMIN_EMAILS (opcional).
      // Si la lista pública no está, el middleware valida con ADMIN_EMAILS en /admin/qa.
      const publicListConfigured = Boolean(
        process.env.NEXT_PUBLIC_ADMIN_EMAILS?.trim()
      );
      if (publicListConfigured && !isAdminEmail(u.email)) {
        setError(
          'Esta cuenta no está autorizada como administrador. Usa un correo de ADMIN_EMAILS.'
        );
        await signOut();
        setUser(null);
        return;
      }
      router.replace('/admin/qa');
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const u = await getSessionUser();
      if (cancelled) return;
      setUser(u);
      setChecking(false);
      if (u) void redirectIfAdmin(u);
    })();
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (u) void redirectIfAdmin(u);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [redirectIfAdmin]);

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/admin/qa`
      : `${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/qa`;

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setError('Escribe un correo válido');
      return;
    }
    // Aviso temprano si la lista pública está configurada
    if (
      process.env.NEXT_PUBLIC_ADMIN_EMAILS &&
      !isAdminEmail(clean)
    ) {
      setError('Ese correo no está en la lista de administradores.');
      return;
    }
    setSending(true);
    try {
      const { data, error: err } = await signInWithMagicLink(clean, redirectTo);
      if (err) {
        setError(err.message);
        return;
      }
      const userPayload = (data as { user?: { id: string; email?: string } } | null)?.user;
      // Mock/dev: sesión inmediata
      if (userPayload && process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        const u = { id: userPayload.id, email: userPayload.email || clean };
        setUser(u);
        await redirectIfAdmin(u);
        return;
      }
      setMessage(`Te enviamos un enlace a ${clean}. Ábrelo para entrar al panel admin.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el enlace');
    } finally {
      setSending(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const { error: err } = await signInWithGoogle(redirectTo);
      if (err) {
        setError(err.message);
        return;
      }
      if (process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        const u = await getSessionUser();
        if (u) {
          setUser(u);
          await redirectIfAdmin(u);
        }
      }
    } finally {
      setSending(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            <Shield className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Admin ViaMorelia</h1>
            <p className="mt-1 text-sm leading-snug text-slate-600">
              Acceso restringido al panel QA. Solo correos en{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAILS</code>.
            </p>
          </div>
        </div>

        <form onSubmit={onMagicLink} className="flex flex-col gap-3">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Correo de administrador
            <input
              data-testid="admin-login-email"
              type="email"
              autoComplete="email"
              placeholder="admin@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/35"
              required
            />
          </label>

          <button
            data-testid="admin-login-magic"
            type="submit"
            disabled={sending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              'Enviar enlace mágico'
            )}
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            o
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            data-testid="admin-login-google"
            type="button"
            disabled={sending}
            onClick={() => void onGoogle()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>
        </form>

        {error && (
          <p
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            role="status"
          >
            {message}
          </p>
        )}
        {user && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Sesión: {user.email} · comprobando permisos…
          </p>
        )}

        <p className="mt-6 text-center text-[11px] leading-snug text-slate-400">
          Esta página no aparece en el menú público. En local sin Supabase real puedes ir
          directo a{' '}
          <Link href="/admin/qa" className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
            /admin/qa
          </Link>
          .
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a ViaMorelia
      </Link>
    </div>
  );
}
