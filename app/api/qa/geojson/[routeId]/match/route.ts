import { NextResponse } from 'next/server';
import {
  callValhallaRoute,
  callValhallaTraceRoute,
  ensureValhallaReady,
  findLiveValhallaUrl,
} from '@/lib/gis/valhalla';
import { densifyWaypoints, thinWaypoints } from '@/lib/gis/fast-align';
import { validateRouteShape } from '@/lib/gis/validation';

export const dynamic = 'force-dynamic';
/** Arranque de Valhalla puede tardar; el modo fast no espera. */
export const maxDuration = 180;

type AlignMode = 'fast' | 'route' | 'trace';

function parseMode(raw: unknown): AlignMode {
  if (raw === 'trace') return 'trace';
  if (raw === 'route') return 'route';
  return 'fast'; // default: alineación rápida
}

export async function POST(
  request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await context.params;
    const body = await request.json();
    const rawCoords = body.coordinates as [number, number][];
    const mode = parseMode(body.mode);

    if (!Array.isArray(rawCoords) || rawCoords.length < 2) {
      return NextResponse.json(
        { error: 'Se requieren al menos 2 coordenadas para alinear.' },
        { status: 400 }
      );
    }

    const validation = validateRouteShape(rawCoords, { maxGapMeters: 500 });
    if (!validation.boundsValid) {
      return NextResponse.json(
        { error: 'Algunas coordenadas están fuera de los límites de Morelia.' },
        { status: 400 }
      );
    }

    console.log(
      `[Snapping API] Alineando ${routeId} mode=${mode} puntos=${rawCoords.length}`
    );

    let snappedCoords: [number, number][] = [];
    let confidence = 1.0;
    let engine: string = mode;
    let warnings: string[] = [...validation.warnings];

    // ─── MODO RÁPIDO: no espera arranque de Valhalla ───
    if (mode === 'fast') {
      const live = await findLiveValhallaUrl();
      if (live) {
        try {
          // Valhalla ya caliente → ruteo por hitos (pocos puntos = muy rápido)
          const hitos = thinWaypoints(rawCoords, 28);
          snappedCoords = await callValhallaRoute(hitos);
          engine = 'valhalla-hitos';
          confidence = 0.95;
        } catch (e) {
          console.warn('[Snapping API] Valhalla falló en fast, densify local:', e);
          snappedCoords = densifyWaypoints(rawCoords, 18);
          engine = 'local-densify';
          confidence = 0.55;
          warnings.push(
            'Valhalla respondió mal; se usó densificado local entre tus puntos.'
          );
        }
      } else {
        // Frío: densificar YA y precalentar en background (no bloquear)
        snappedCoords = densifyWaypoints(rawCoords, 18);
        engine = 'local-densify';
        confidence = 0.5;
        warnings.push(
          'Alineación rápida entre tus hitos (Valhalla aún arrancando). Cuando esté caliente, usa “Preciso” o vuelve a alinear.'
        );
        void ensureValhallaReady().catch((err) =>
          console.warn('[Snapping API] warm background falló:', err)
        );
      }
    } else if (mode === 'route') {
      // Preciso hitos: espera Valhalla
      try {
        await ensureValhallaReady();
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : 'Valhalla no disponible. Usa modo Rápido o arranca WSL.',
          },
          { status: 503 }
        );
      }
      const hitos = thinWaypoints(rawCoords, 40);
      snappedCoords = await callValhallaRoute(hitos);
      engine = 'valhalla-route';
      confidence = 0.95;
    } else {
      // trace: map-matching denso, espera Valhalla
      try {
        await ensureValhallaReady();
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : 'Valhalla no disponible. Usa modo Rápido o arranca WSL.',
          },
          { status: 503 }
        );
      }
      const res = await callValhallaTraceRoute(rawCoords);
      snappedCoords = res.coordinates;
      confidence = res.confidence;
      engine = 'valhalla-trace';
    }

    if (snappedCoords.length < 2) {
      return NextResponse.json(
        { error: 'No se pudo generar un trazo válido con estos puntos.' },
        { status: 422 }
      );
    }

    const finalValidation = validateRouteShape(snappedCoords, { maxGapMeters: 500 });
    warnings = [...warnings, ...finalValidation.warnings];

    return NextResponse.json({
      ok: true,
      mode,
      engine,
      originalCount: rawCoords.length,
      snappedCount: snappedCoords.length,
      coordinates: snappedCoords,
      confidence,
      validation: {
        isValid: finalValidation.isValid,
        gaps: finalValidation.gaps,
        warnings,
      },
    });
  } catch (e) {
    console.error('[Snapping API] Error al alinear ruta:', e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Error interno al procesar el alineado.',
      },
      { status: 500 }
    );
  }
}
