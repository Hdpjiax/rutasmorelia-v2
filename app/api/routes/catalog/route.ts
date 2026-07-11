import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Catálogo de rutas con ISR-like revalidate (5 min).
 * Evita pegarle a Supabase: lee public/routes/index.json del deploy.
 */
export const revalidate = 300;
export const dynamic = 'force-static';

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'public', 'routes', 'index.json');
    const raw = await readFile(file, 'utf8');
    const json = JSON.parse(raw);
    return NextResponse.json(json, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json(
      { type: 'RouteIndex', routes: [], count: 0, error: 'catalog_unavailable' },
      { status: 503 }
    );
  }
}
