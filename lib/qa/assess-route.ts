import type { QaFinalReport, QaIssue, QaStatus } from './types';

export function deriveRouteStatus(issues: QaIssue[]): QaStatus {
  if (issues.some((i) => i.severity === 'critical')) return 'rejected';
  if (issues.some((i) => i.severity === 'review')) return 'needs_review';
  return 'approved';
}

export function countIssuesBySeverity(issues: QaIssue[]) {
  return {
    critical: issues.filter((i) => i.severity === 'critical').length,
    review: issues.filter((i) => i.severity === 'review').length,
  };
}

export function isValhallaValidated(validator?: string | null): boolean {
  if (!validator) return false;
  const v = validator.toLowerCase();
  return v.includes('valhalla') && !v.includes('fallback');
}

export function formatSnapDistance(meters?: number | null): string {
  if (meters == null || Number.isNaN(meters)) return '—';
  return `${meters.toFixed(1)} m`;
}

export function statusLabel(status: QaStatus): string {
  switch (status) {
    case 'approved':
      return 'Aprobada';
    case 'needs_review':
      return 'Revisión';
    case 'rejected':
      return 'Rechazada';
  }
}

export function statusColorClass(status: QaStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'needs_review':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'rejected':
      return 'bg-rose-100 text-rose-800 border-rose-200';
  }
}

export function summarizeReport(report: QaFinalReport) {
  const counts = countIssuesBySeverity(report.issues);
  return {
    routeId: report.route_id,
    routeName: report.route_name,
    status: report.status,
    publishable: report.publishable,
    criticalCount: counts.critical,
    reviewCount: counts.review,
    directions: report.directions.map((d) => ({
      direction: d.direction,
      status: d.qa_status,
      validator: d.validator,
      valhallaOk: isValhallaValidated(d.validator),
      avgSnap: d.avg_snap_m,
      maxSnap: d.max_snap_m,
      confidence: d.confidence,
    })),
  };
}