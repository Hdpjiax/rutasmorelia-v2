'use client';

import React from 'react';
import Link from 'next/link';

/** Enlaces legales compactos (panel favoritos / ajustes). */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[10px] leading-snug text-slate-400 ${className}`}>
      <Link
        href="/privacidad"
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700"
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacidad
      </Link>
      {' · '}
      <Link
        href="/terminos"
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700"
        target="_blank"
        rel="noopener noreferrer"
      >
        Términos
      </Link>
      <span className="mt-0.5 block text-slate-400">Datos locales · sin cuenta de pasajero</span>
    </p>
  );
}
