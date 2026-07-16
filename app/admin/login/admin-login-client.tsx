'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Terminal } from 'lucide-react';

/**
 * Ya no hay login por correo.
 * En `pnpm dev` el middleware redirige a /admin/qa;
 * esta UI es un aviso por si alguien entra en producción o con build.
 */
export function AdminLoginClient() {
  const router = useRouter();
  const isLocalDev =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_VERCEL !== '1';

  useEffect(() => {
    // En dev, ir directo al panel (el middleware también redirige)
    if (process.env.NODE_ENV !== 'production') {
      router.replace('/admin/qa');
    }
  }, [router]);

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
              El panel QA ya no usa correo ni Google. Solo se abre en tu máquina con
              desarrollo local.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <p className="mb-2 flex items-center gap-2 font-bold text-slate-900">
            <Terminal className="h-4 w-4 text-emerald-700" aria-hidden />
            Cómo entrar
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 leading-snug">
            <li>
              En la raíz del repo: <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-slate-200">pnpm dev</code>
            </li>
            <li>
              Abre{' '}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-slate-200">
                http://localhost:3000/admin/qa
              </code>
            </li>
          </ol>
          <p className="mt-3 text-xs leading-snug text-slate-500">
            No hay login. En Vercel / producción el panel está bloqueado a propósito
            (edición de rutas solo en local + git push + seed).
          </p>
        </div>

        {isLocalDev && (
          <Link
            href="/admin/qa"
            className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            Ir al panel QA
          </Link>
        )}
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
