import type { Metadata } from 'next';
import { AdminLoginClient } from './admin-login-client';

export const metadata: Metadata = {
  title: 'Admin · ViaMorelia',
  description: 'Panel QA solo en desarrollo local',
  robots: { index: false, follow: false },
};

/**
 * Ya no hay login por correo.
 * En `pnpm dev` el middleware redirige a /admin/qa.
 * Esta página solo explica el acceso local.
 */
export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
