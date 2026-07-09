import { NextResponse } from 'next/server';
import { loadAllFinalReports, loadQaSummary } from '@/lib/qa/load-reports';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [summary, reports] = await Promise.all([loadQaSummary(), loadAllFinalReports()]);
  return NextResponse.json({ summary, reports });
}