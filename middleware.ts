import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Protege /admin/* y /api/qa/*:
 * - Requiere sesión Supabase
 * - Email en ADMIN_EMAILS (o lista vacía solo en local no-Vercel)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith('/admin');
  const isQaApi = pathname.startsWith('/api/qa');
  // Login admin accesible sin sesión (solo UI oculta; no es la app pública)
  const isAdminLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (!isAdminPage && !isQaApi) {
    return NextResponse.next();
  }

  if (isAdminLogin) {
    return NextResponse.next();
  }

  // En Vercel, APIs de mutación QA (match/save/delete) no son el flujo oficial
  // (disco efímero). Se permiten GET de lectura si el admin está autenticado.
  const isMutatingQa =
    isQaApi &&
    (pathname.includes('/match') ||
      pathname.includes('/save') ||
      (request.method === 'DELETE' && pathname.includes('/api/qa/routes')));

  if (isMutatingQa && process.env.VERCEL === '1') {
    return NextResponse.json(
      {
        error:
          'Admin QA de escritura solo en local. Edita en tu PC y publica con git push + seed.',
        code: 'ADMIN_LOCAL_ONLY',
      },
      { status: 501 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminList = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Sin Supabase real: bloquear admin en producción Vercel
  if ((!url || !anon || process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') && process.env.VERCEL === '1') {
    if (isAdminPage) {
      const u = request.nextUrl.clone();
      u.pathname = '/';
      // Preferir login admin dedicado (no ensucia la home pública)
      u.pathname = '/admin/login';
      return NextResponse.redirect(u);
    }
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Local sin Supabase real: permitir (dev con mock)
  if (!url || !anon || process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? null;
  const allowed =
    Boolean(email) &&
    (adminList.length === 0
      ? process.env.VERCEL !== '1' // sin lista: solo local
      : adminList.includes(email!));

  if (!allowed) {
    if (isAdminPage) {
      const u = request.nextUrl.clone();
      u.pathname = '/admin/login';
      u.searchParams.set('admin', 'required');
      return NextResponse.redirect(u);
    }
    return NextResponse.json(
      { error: 'Se requiere sesión de administrador', code: 'ADMIN_REQUIRED' },
      { status: 401 }
    );
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/qa/:path*'],
};
