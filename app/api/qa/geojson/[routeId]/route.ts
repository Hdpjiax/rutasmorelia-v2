import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Devuelve el GeoJSON de trabajo del admin.
 * Prioridad: borrador matched (ediciones guardadas) → processed → public (publicado).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  const { routeId } = await context.params;
  const safeId = routeId.replace(/[^a-zA-Z0-9_-]/g, '');

  const candidates = [
    // 1. Borrador / última edición (admin)
    path.join(process.cwd(), 'data', 'processed', 'matched', `${safeId}.geojson`),
    path.join(process.cwd(), 'data', 'processed', 'geojson', `${safeId}.geojson`),
    // 2. Versión publicada (usuarios)
    path.join(process.cwd(), 'public', 'routes', `${safeId}.geojson`),
  ];

  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return new NextResponse(raw, {
        headers: {
          'Content-Type': 'application/geo+json',
          'X-Route-Source': path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: 'GeoJSON no encontrado' }, { status: 404 });
}
