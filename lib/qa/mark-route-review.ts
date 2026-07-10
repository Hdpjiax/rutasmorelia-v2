import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { QaFinalReport, QaIssue, QaSummary } from './types';
import { loadAllFinalReports } from './load-reports';
import { projectPath } from '@/lib/server/project-root';

const QA_DIR = projectPath('data', 'qa-reports');

export async function refreshQaSummary(): Promise<QaSummary> {
  const reports = await loadAllFinalReports();
  const summary: QaSummary = {
    generated_at: new Date().toISOString(),
    totals: {
      routes: reports.length,
      approved: reports.filter((r) => r.status === 'approved').length,
      needs_review: reports.filter((r) => r.status === 'needs_review').length,
      rejected: reports.filter((r) => r.status === 'rejected').length,
    },
    routes: reports.map((r) => ({
      route_id: r.route_id,
      route_name: r.route_name,
      status: r.status,
      publishable: r.publishable,
      issue_count: r.issues.length,
      directions: r.directions.map((d) => d.direction),
    })),
  };
  await writeFile(
    path.join(QA_DIR, 'qa-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );
  return summary;
}

export async function markRouteForManualReview(
  routeId: string,
  note: string
): Promise<QaFinalReport | null> {
  const reportPath = path.join(QA_DIR, `${routeId}.final_qa.json`);
  let report: QaFinalReport;
  try {
    const raw = await readFile(reportPath, 'utf-8');
    report = JSON.parse(raw) as QaFinalReport;
  } catch {
    return null;
  }

  const manualIssue: QaIssue = {
    severity: 'review',
    issue: `Revisión manual: ${note.trim()}`,
  };

  const otherIssues = report.issues.filter(
    (i) => !i.issue.startsWith('Revisión manual:')
  );

  report = {
    ...report,
    status: 'needs_review',
    publishable: false,
    pass: false,
    issues: [...otherIssues, manualIssue],
    directions: report.directions.map((d) => ({
      ...d,
      qa_status: 'needs_review',
    })),
    validated_at: new Date().toISOString(),
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  await refreshQaSummary();
  return report;
}