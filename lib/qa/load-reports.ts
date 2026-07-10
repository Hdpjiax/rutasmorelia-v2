import fs from 'fs/promises';
import path from 'path';
import type { QaFinalReport, QaMatchFeatureReport, QaSummary } from './types';
import { loadRouteTransportMap } from '@/lib/transport/load-route-transport-map';
import { normalizeTransportType, toStoredTransportType } from '@/lib/transport/classify';
import { projectPath } from '@/lib/server/project-root';

const QA_DIR = projectPath('data', 'qa-reports');

export async function loadQaSummary(): Promise<QaSummary | null> {
  try {
    const raw = await fs.readFile(path.join(QA_DIR, 'qa-summary.json'), 'utf-8');
    return JSON.parse(raw) as QaSummary;
  } catch {
    return null;
  }
}

function enrichTransport(
  report: QaFinalReport,
  transportMap: Map<string, 'combi' | 'foraneo'>
): QaFinalReport {
  const fromMap = transportMap.get(report.route_id);
  const kind = normalizeTransportType(
    report.transport_type ?? fromMap,
    report.route_id,
    report.route_name
  );
  return {
    ...report,
    transport_type: toStoredTransportType(kind),
  };
}

export async function loadFinalQaReport(routeId: string): Promise<QaFinalReport | null> {
  try {
    const raw = await fs.readFile(path.join(QA_DIR, `${routeId}.final_qa.json`), 'utf-8');
    const report = JSON.parse(raw) as QaFinalReport;
    const map = await loadRouteTransportMap();
    return enrichTransport(report, map);
  } catch {
    return null;
  }
}

export async function loadMatchQaReport(routeId: string): Promise<QaMatchFeatureReport[] | null> {
  try {
    const raw = await fs.readFile(path.join(QA_DIR, `${routeId}.qa.json`), 'utf-8');
    return JSON.parse(raw) as QaMatchFeatureReport[];
  } catch {
    return null;
  }
}

export async function loadAllFinalReports(): Promise<QaFinalReport[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(QA_DIR);
  } catch {
    return [];
  }

  const transportMap = await loadRouteTransportMap();
  const reports: QaFinalReport[] = [];
  for (const file of files.filter((f) => f.endsWith('.final_qa.json'))) {
    try {
      const raw = await fs.readFile(path.join(QA_DIR, file), 'utf-8');
      const report = JSON.parse(raw) as QaFinalReport;
      reports.push(enrichTransport(report, transportMap));
    } catch {
      // omit corrupt report
    }
  }
  return reports.sort((a, b) => a.route_id.localeCompare(b.route_id));
}