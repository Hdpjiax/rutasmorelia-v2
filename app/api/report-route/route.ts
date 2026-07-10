import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  routeId: z.string().min(1).max(120),
  routeName: z.string().max(160).optional(),
  reason: z.enum([
    'trace_wrong',
    'no_longer_passes',
    'missing_route',
    'wrong_name',
    'direction_wrong',
    'other',
  ]),
  note: z.string().max(500).optional(),
});

/**
 * Reportes de problemas de rutas (anónimos).
 * Persistencia real puede enlazarse a Supabase; por ahora log + 200.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
    }
    const row = {
      ...parsed.data,
      at: new Date().toISOString(),
      ua: request.headers.get('user-agent')?.slice(0, 120) ?? null,
    };
    console.info('[report-route]', JSON.stringify(row));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
