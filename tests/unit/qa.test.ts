import { describe, it, expect } from 'vitest';
import {
  countIssuesBySeverity,
  deriveRouteStatus,
  isValhallaValidated,
  statusLabel,
  summarizeReport,
} from '@/lib/qa/assess-route';
import type { QaFinalReport, QaIssue } from '@/lib/qa/types';

describe('QA assess-route', () => {
  it('derives rejected when critical issues exist', () => {
    const issues: QaIssue[] = [
      { severity: 'review', issue: 'needs review' },
      { severity: 'critical', issue: 'gap too large' },
    ];
    expect(deriveRouteStatus(issues)).toBe('rejected');
  });

  it('derives needs_review without critical issues', () => {
    const issues: QaIssue[] = [{ severity: 'review', issue: 'fallback validator' }];
    expect(deriveRouteStatus(issues)).toBe('needs_review');
  });

  it('derives approved with no issues', () => {
    expect(deriveRouteStatus([])).toBe('approved');
  });

  it('counts issues by severity', () => {
    const issues: QaIssue[] = [
      { severity: 'critical', issue: 'a' },
      { severity: 'review', issue: 'b' },
      { severity: 'review', issue: 'c' },
    ];
    expect(countIssuesBySeverity(issues)).toEqual({ critical: 1, review: 2 });
  });

  it('detects Valhalla validator', () => {
    expect(isValhallaValidated('valhalla+osrm')).toBe(true);
    expect(isValhallaValidated('python-shapely-fallback')).toBe(false);
  });

  it('maps status labels to Spanish', () => {
    expect(statusLabel('approved')).toBe('Aprobada');
    expect(statusLabel('needs_review')).toBe('Revisión');
    expect(statusLabel('rejected')).toBe('Rechazada');
  });

  it('summarizes a final report', () => {
    const report: QaFinalReport = {
      file: 'data/processed/matched/demo.geojson',
      route_id: 'demo',
      route_name: 'Demo',
      status: 'needs_review',
      publishable: false,
      pass: false,
      validated_at: '2026-07-08T00:00:00Z',
      issues: [{ severity: 'review', issue: 'fallback' }],
      directions: [
        {
          direction: 'ida',
          qa_status: 'approved',
          validator: 'valhalla+osrm',
          avg_snap_m: 5,
          max_snap_m: 8,
          confidence: 0.95,
          issues: [],
        },
      ],
    };
    const summary = summarizeReport(report);
    expect(summary.routeId).toBe('demo');
    expect(summary.directions[0].valhallaOk).toBe(true);
    expect(summary.reviewCount).toBe(1);
  });
});