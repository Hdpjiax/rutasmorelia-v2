import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { projectPath, projectRoot } from '@/lib/server/project-root';

export const dynamic = 'force-dynamic';

/**
 * Devuelve el GeoJSON de trabajo del admin.
 * Prioridad: borrador matched (ediciones guardadas) → processed → public (publicado).
 * En Vercel solo suele existir public/routes (data/* es local).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  const { routeId } = await context.params;
  const safeId = routeId.replace(/[^a-zA-Z0-9_-]/g, '');

  const candidates = [
    // 1. Borrador / última edición (admin local)
    projectPath('data', 'processed', 'matched', `${safeId}.geojson`),
    projectPath('data', 'processed', 'geojson', `${safeId}.geojson`),
    // 2. Versión publicada (usuarios / Vercel)
    projectPath('public', 'routes', `${safeId}.geojson`),
  ];

  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return new NextResponse(raw, {
        headers: {
          'Content-Type': 'application/geo+json',
          'X-Route-Source': path.relative(projectRoot(), filePath).replace(/\\/g, '/'),
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: 'GeoJSON no encontrado' }, { status: 404 });
}
