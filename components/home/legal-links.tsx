'use client';

import React from 'react';
import { openExternalUrl } from '@/lib/utils/external-link';

/** Enlaces legales compactos (panel favoritos / ajustes). */
export function LegalLinks({ className = '' }: { className?: string }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    // En entornos nativos es necesario pasar la URL absoluta para que el navegador nativo lo abra.
    const absoluteUrl = window.location.origin + path;
    void openExternalUrl(absoluteUrl);
  };

  return (
    <p className={`text-center text-[10px] leading-snug text-slate-400 ${className}`}>
      <a
        href="/privacidad"
        onClick={(e) => handleClick(e, '/privacidad')}
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700 cursor-pointer"
      >
        Privacidad
      </a>
      {' · '}
      <a
        href="/terminos"
        onClick={(e) => handleClick(e, '/terminos')}
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700 cursor-pointer"
      >
        Términos
      </a>
      <span className="mt-0.5 block text-slate-400">Datos locales · sin cuenta de pasajero</span>
    </p>
  );
}
