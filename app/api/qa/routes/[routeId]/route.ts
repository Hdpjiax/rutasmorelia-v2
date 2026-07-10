import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { refreshQaSummary } from '@/lib/qa/mark-route-review';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/qa/routes/[routeId]
 * Elimina geojson (matched/processed/public), reportes QA y entrada del índice.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await context.params;
    const safeId = routeId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) {
      return NextResponse.json({ error: 'routeId inválido' }, { status: 400 });
    }

    const root = process.cwd();
    const files = [
      path.join(root, 'data', 'processed', 'matched', `${safeId}.geojson`),
      path.join(root, 'data', 'processed', 'geojson', `${safeId}.geojson`),
      path.join(root, 'public', 'routes', `${safeId}.geojson`),
      path.join(root, 'data', 'qa-reports', `${safeId}.final_qa.json`),
      path.join(root, 'data', 'qa-reports', `${safeId}.qa.json`),
      path.join(root, 'data', 'processed', 'supabase-mirror', `${safeId}.json`),
    ];

    const removed: string[] = [];
    for (const file of files) {
      try {
        await fs.unlink(file);
        removed.push(path.relative(root, file));
      } catch {
        /* no existía */
      }
    }

    // Quitar del index.json
    const indexPath = path.join(root, 'public', 'routes', 'index.json');
    try {
      const raw = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(raw) as { type?: string; routes?: Array<{ id: string }> };
      const before = index.routes?.length ?? 0;
      index.routes = (index.routes ?? []).filter((r) => r.id !== safeId);
      if ((index.routes?.length ?? 0) !== before) {
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
        removed.push('public/routes/index.json (entry)');
      }
    } catch {
      /* ignore */
    }

    // Quitar nota de revisión si existe
    try {
      const notesPath = path.join(root, 'data', 'qa-reports', 'review-notes.json');
      const raw = await fs.readFile(notesPath, 'utf-8');
      const data = JSON.parse(raw) as { notes?: Array<{ route_id: string }> };
      if (Array.isArray(data.notes)) {
        data.notes = data.notes.filter((n) => n.route_id !== safeId);
        await fs.writeFile(notesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      }
    } catch {
      /* ignore */
    }

    await refreshQaSummary();

    return NextResponse.json({
      ok: true,
      routeId: safeId,
      removed,
    });
  } catch (e) {
    console.error('[DELETE route]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar ruta' },
      { status: 500 }
    );
  }
}
