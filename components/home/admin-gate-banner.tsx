/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

/**
 * Aviso cuando middleware redirige desde /admin por falta de permisos
 * (?admin=required | ?admin=login).
 */
export function AdminGateBanner() {
  const [reason, setReason] = useState<'required' | 'login' | null>(null);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const admin = sp.get('admin');
      if (admin === 'required' || admin === 'login') {
        setReason(admin);
        sp.delete('admin');
        const next = `${window.location.pathname}${sp.toString() ? `?${sp}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!reason) return null;

  return (
    <div
      className="absolute left-3 right-3 top-3 z-[60] mx-auto max-w-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      role="alert"
    >
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-lg">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-amber-900">Panel admin no disponible</p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
            {reason === 'login'
              ? 'Inicia sesión con una cuenta autorizada (ADMIN_EMAILS) para acceder al QA.'
              : 'Tu sesión no tiene permiso de administrador. Solo correos en ADMIN_EMAILS pueden entrar a /admin/qa.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReason(null)}
          className="rounded-lg p-1 text-amber-700 hover:bg-amber-100 cursor-pointer"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
