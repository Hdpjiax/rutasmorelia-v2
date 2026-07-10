'use client';

/** Enlace de salto al contenido principal (teclado / lectores de pantalla). */
export function SkipLink({ href = '#main-content', label = 'Saltar al contenido' }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-emerald-800 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
    >
      {label}
    </a>
  );
}
