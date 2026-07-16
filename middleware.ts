import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protege /admin/* y /api/qa/*:
 * - Solo en desarrollo local (`pnpm dev`): acceso abierto, sin login.
 * - En Vercel / production: bloqueado (no hay login por correo).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith('/admin');
  const isQaApi = pathname.startsWith('/api/qa');

  if (!isAdminPage && !isQaApi) {
    return NextResponse.next();
  }

  const isLocalDev =
    process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production';

  // pnpm dev → pasar sin autenticación
  if (isLocalDev) {
    // Login legacy: redirigir al panel
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      const u = request.nextUrl.clone();
      u.pathname = '/admin/qa';
      u.search = '';
      return NextResponse.redirect(u);
    }
    return NextResponse.next();
  }

  // Producción / Vercel: sin acceso (escritura QA ya era local-only)
  if (isAdminPage) {
    const u = request.nextUrl.clone();
    u.pathname = '/';
    u.search = '';
    return NextResponse.redirect(u);
  }

  return NextResponse.json(
    {
      error: 'Panel QA solo disponible en desarrollo local (pnpm dev).',
      code: 'ADMIN_LOCAL_ONLY',
    },
    { status: 403 }
  );
}

export const config = {
  matcher: ['/admin/:path*', '/api/qa/:path*'],
};
