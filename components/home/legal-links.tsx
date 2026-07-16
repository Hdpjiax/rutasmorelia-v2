'use client';

import React from 'react';

type Props = {
  className?: string;
  onOpenPrivacidad?: () => void;
  onOpenTerminos?: () => void;
};

/** Enlaces legales compactos (panel favoritos / ajustes). Abre sheet in-app si hay callbacks. */
export function LegalLinks({
  className = '',
  onOpenPrivacidad,
  onOpenTerminos,
}: Props) {
  return (
    <p className={`text-center text-[10px] leading-snug text-slate-400 ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (onOpenPrivacidad) onOpenPrivacidad();
          else window.location.assign('/privacidad');
        }}
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700 cursor-pointer"
      >
        Privacidad
      </button>
      {' · '}
      <button
        type="button"
        onClick={() => {
          if (onOpenTerminos) onOpenTerminos();
          else window.location.assign('/terminos');
        }}
        className="font-semibold text-slate-500 underline decoration-slate-300 hover:text-emerald-700 cursor-pointer"
      >
        Términos
      </button>
      <span className="mt-0.5 block text-slate-400">Datos locales · sin cuenta de pasajero</span>
    </p>
  );
}
