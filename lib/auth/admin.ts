/**
 * Control de acceso al panel admin QA.
 * ADMIN_EMAILS=correo1@x.com,correo2@y.com (server)
 * NEXT_PUBLIC_ADMIN_EMAILS opcional solo para UI (misma lista).
 */

export function getAdminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    '';
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  // Sin lista configurada: en desarrollo local permitir; en Vercel denegar
  if (list.length === 0) {
    return process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production';
  }
  return list.includes(email.trim().toLowerCase());
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}
