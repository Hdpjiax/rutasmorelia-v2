import { NextResponse } from 'next/server';
import {
  deleteReviewNote,
  loadReviewNotes,
  saveReviewNoteOnly,
  saveReviewNoteSentToReview,
} from '@/lib/qa/review-notes';
import { markRouteForManualReview } from '@/lib/qa/mark-route-review';

export async function GET() {
  const notes = await loadReviewNotes();
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const route_id = String(body.route_id ?? '').trim();
    const route_name = String(body.route_name ?? route_id).trim();
    const note = String(body.note ?? '').trim();
    const flags = body.flags; // lista de pines georreferenciados
    const action = body.action === 'send_to_review' ? 'send_to_review' : 'save_note';

    if (!route_id) {
      return NextResponse.json({ error: 'route_id requerido' }, { status: 400 });
    }
    if (!note && !flags) {
      return NextResponse.json({ error: 'La nota o los flags no pueden estar vacíos' }, { status: 400 });
    }

    if (action === 'send_to_review') {
      const updatedReport = await markRouteForManualReview(route_id, note);
      if (!updatedReport) {
        return NextResponse.json(
          { error: 'No se encontró el reporte QA de esta ruta' },
          { status: 404 }
        );
      }
      const saved = await saveReviewNoteSentToReview({
        route_id,
        route_name,
        note,
        flags,
        created_by: body.created_by ? String(body.created_by) : undefined,
      });
      return NextResponse.json({
        ok: true,
        action,
        note: saved,
        report: updatedReport,
      });
    }

    const saved = await saveReviewNoteOnly({
      route_id,
      route_name,
      note,
      flags,
      created_by: body.created_by ? String(body.created_by) : undefined,
    });

    return NextResponse.json({ ok: true, action, note: saved });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get('route_id');
  if (!routeId) {
    return NextResponse.json({ error: 'route_id requerido' }, { status: 400 });
  }
  const removed = await deleteReviewNote(routeId);
  return NextResponse.json({ ok: removed });
}