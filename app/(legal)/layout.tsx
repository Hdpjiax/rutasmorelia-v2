import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/**
 * Layout para páginas legales: scroll normal (no shell de mapa fullscreen).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-legal-page
      className="min-h-dvh overflow-y-auto overscroll-y-auto bg-slate-50 text-slate-900 antialiased"
    >
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
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
      <main className="mx-auto max-w-2xl px-4 py-8 pb-16">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-[11px] text-slate-500">
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
