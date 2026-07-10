'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';

type AuthPanelProps = {
  user: SessionUser | null;
  email: string;
  authError: string | null;
  authMessage: string | null;
  authSending: boolean;
  onEmailChange: (value: string) => void;
  onMagicLink: (e: React.FormEvent) => void;
  onGoogle: () => void;
  onLogout: (everywhere?: boolean) => void;
  onClose: () => void;
};

/**
 * Panel de cuenta: enlace mágico, Google, cerrar sesión.
 * Favoritos se sincronizan con Supabase cuando hay user.
 */
export function AuthPanel({
  user,
  email,
  authError,
  authMessage,
  authSending,
  onEmailChange,
  onMagicLink,
  onGoogle,
  onLogout,
  onClose,
}: AuthPanelProps) {
  if (user) {
    return (
      <div className="flex w-80 flex-col gap-2.5 p-3.5" role="dialog" aria-label="Cuenta">
        <p className="text-sm font-semibold text-slate-800" data-testid="user-profile-header">
          {user.email}
        </p>
        <p className="text-[10px] text-slate-500">
          Favoritos sincronizados con tu cuenta
        </p>
        <button
          type="button"
          onClick={() => {
            void onLogout(false);
            onClose();
          }}
          className="rounded-xl bg-slate-900 py-2 text-xs font-bold text-white cursor-pointer"
        >
          Cerrar sesión
        </button>
        <button
          type="button"
          data-testid="logout-everywhere"
          onClick={() => {
            void onLogout(true);
            onClose();
          }}
          className="rounded-xl border border-slate-300 bg-white py-2 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50"
        >
          Cerrar en todos los dispositivos
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onMagicLink} className="flex w-80 flex-col gap-2.5 p-3.5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Entrar o registrarte
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
          Sin contraseña: te enviamos un enlace mágico al correo, o usa Google.
        </p>
      </div>
      <input
        data-testid="login-email"
        type="email"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        autoComplete="email"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        required
      />
      <button
        data-testid="login-magic-link"
        type="submit"
        disabled={authSending}
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
      >
        {authSending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </>
        ) : (
          'Enviar enlace mágico'
        )}
      </button>
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        o
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button
        data-testid="login-google"
        type="button"
        disabled={authSending}
        onClick={onGoogle}
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
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
      {authMessage && (
        <p
          data-testid="login-magic-sent"
          className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium leading-snug text-emerald-800"
          role="status"
        >
          {authMessage}
        </p>
      )}
      {authError && (
        <p className="text-[11px] font-medium text-rose-500" role="alert">
          {authError}
        </p>
      )}
    </form>
  );
}
