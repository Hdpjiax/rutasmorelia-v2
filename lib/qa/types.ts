export type QaSeverity = 'critical' | 'review';
export type QaStatus = 'approved' | 'needs_review' | 'rejected';

export interface QaIssue {
  feature?: number;
  direction?: string;
  severity: QaSeverity;
  issue: string;
  gap?: { index: number; distance_m: number };
}

export interface QaDirectionDetail {
  direction: string;
  qa_status?: QaStatus | string | null;
  validator?: string | null;
  avg_snap_m?: number | null;
  max_snap_m?: number | null;
  confidence?: number | null;
  issues: QaIssue[];
}

export interface QaFinalReport {
  file: string;
  route_id: string;
  route_name: string;
  status: QaStatus;
  publishable: boolean;
  issues: QaIssue[];
  directions: QaDirectionDetail[];
  pass: boolean;
  validated_at: string;
  /** combi | foraneo (u otros); UI agrupa foraneo como Autobús */
  transport_type?: string | null;
}

export interface QaSummary {
  generated_at: string;
  totals: {
    routes: number;
    approved: number;
    needs_review: number;
    rejected: number;
  };
  routes: Array<{
    route_id: string;
    route_name: string;
    status: QaStatus;
    publishable: boolean;
    issue_count: number;
    directions: string[];
  }>;
}

export interface QaMatchFeatureReport {
  feature: number;
  status: QaStatus;
  issue?: string;
  metrics?: {
    avg_snap_m?: number;
    max_snap_m?: number;
    confidence?: number;
    note?: string;
  };
}