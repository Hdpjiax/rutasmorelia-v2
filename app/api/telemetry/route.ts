import { NextResponse } from 'next/server';

/**
 * Ingesta opcional de telemetría anónima (no PII).
 * En producción podrías reenviar a un log drain; aquí solo aceptamos y descartamos.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    // No persistir PII. Máximo silencioso.
    if (process.env.NODE_ENV === 'development' && body?.event) {
      console.info('[api/telemetry]', body.event?.type);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST anonymous UI telemetry events',
  });
}
