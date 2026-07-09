import QaAdminPanel from './qa-admin-panel';
import { loadAllFinalReports, loadQaSummary } from '@/lib/qa/load-reports';

export const metadata = {
  title: 'Panel QA · Rutas Morelia',
  description: 'Validación de rutas: dos sentidos, eje vial y reportes GIS',
};

export default async function QaAdminPage() {
  const [summary, reports] = await Promise.all([loadQaSummary(), loadAllFinalReports()]);

  return <QaAdminPanel initialSummary={summary} initialReports={reports} />;
}