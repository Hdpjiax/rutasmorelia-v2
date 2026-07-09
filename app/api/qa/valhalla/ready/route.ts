import { NextResponse } from 'next/server';
import { ensureValhallaReady, findLiveValhallaUrl } from '@/lib/gis/valhalla';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * GET ?warm=1 — precalienta Valhalla en background (admin).
 * GET sin warm — solo reporta si ya responde.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warm = searchParams.get('warm') === '1' || searchParams.get('warm') === 'true';

  try {
    if (!warm) {
      const live = await findLiveValhallaUrl();
      return NextResponse.json({
        ok: Boolean(live),
        ready: Boolean(live),
        url: live,
        warming: false,
      });
    }

    // Arranque (puede tardar); el admin lo llama en background
    const url = await ensureValhallaReady({ forceCheck: true });
    return NextResponse.json({
      ok: true,
      ready: true,
      url,
      warming: false,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        error: e instanceof Error ? e.message : 'No se pudo preparar Valhalla',
      },
      { status: 503 }
    );
  }
}
