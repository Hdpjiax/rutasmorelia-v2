import type { Metadata } from 'next';
import { AdminLoginClient } from './admin-login-client';

export const metadata: Metadata = {
  title: 'Admin · ViaMorelia',
  description: 'Acceso restringido al panel de administración',
  robots: { index: false, follow: false },
};

/**
 * Login oculto solo para administradores (ADMIN_EMAILS).
 * No hay enlace en la UI pública; la URL se comparte al equipo.
 */
export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
