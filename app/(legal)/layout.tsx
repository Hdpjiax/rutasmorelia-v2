import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { LegalScrollUnlock } from '@/components/legal/legal-scroll-unlock';
import { LegalTopInset } from '@/components/legal/legal-top-inset';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/**
 * Layout legal — scroll de documento.
 *
 * El header NO usa solo env(safe-area): en Android es 0 y se corta
 * (solo se ve un trozo del botón verde "Abrir mapa"). Hay una franja
 * medible con JS (LegalTopInset) de ≥72px en Android.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-legal-page className="vm-legal-page">
      <LegalScrollUnlock />

      {/* Franja bajo status bar / notch — siempre visible, no sticky */}
      <LegalTopInset />

      <header className="vm-legal-page-header">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-emerald-800">
            <Image
              src="/brand/icono-64.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="truncate">ViaMorelia</span>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
            <Link href="/privacidad" className="hover:text-emerald-700">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-emerald-700">
              Términos
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
            >
              Abrir mapa
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="vm-legal-page-footer border-t border-slate-200 bg-white py-6 text-center text-[11px] text-slate-500">
        <p>ViaMorelia · Morelia, Michoacán, México</p>
        <p className="mt-1">
          <Link href="/privacidad" className="underline hover:text-emerald-700">
            Privacidad
          </Link>
          {' · '}
          <Link href="/terminos" className="underline hover:text-emerald-700">
            Términos
          </Link>
        </p>
      </footer>
    </div>
  );
}
