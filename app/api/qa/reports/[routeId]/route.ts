import { NextResponse } from 'next/server';
import { loadFinalQaReport, loadMatchQaReport } from '@/lib/qa/load-reports';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  const { routeId } = await context.params;
  const [finalReport, matchReport] = await Promise.all([
    loadFinalQaReport(routeId),
    loadMatchQaReport(routeId),
  ]);

  if (!finalReport) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ finalReport, matchReport });
}