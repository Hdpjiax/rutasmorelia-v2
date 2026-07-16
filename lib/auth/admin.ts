/**
 * Control de acceso al panel admin QA.
 *
 * Política actual:
 * - Solo desarrollo local (`pnpm dev`): acceso abierto, sin login.
 * - Producción / Vercel: bloqueado (no hay login por correo).
 */

/** true en `next dev` local (no Vercel, no production build). */
export function isLocalAdminDev(): boolean {
  if (process.env.VERCEL === '1') return false;
  // next dev → NODE_ENV=development
  return process.env.NODE_ENV !== 'production';
}

/** Admin QA permitido solo en dev local. */
export function isAdminAccessAllowed(): boolean {
  return isLocalAdminDev();
}

/** @deprecated Prefer isLocalAdminDev / isAdminAccessAllowed. */
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

/**
 * @deprecated Ya no se usa login por correo para admin.
 * Se mantiene por tests/compat: en local dev cualquier email “pasa”;
 * en producción siempre false.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!isLocalAdminDev()) return false;
  // En dev no se valida correo
  return true;
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}
