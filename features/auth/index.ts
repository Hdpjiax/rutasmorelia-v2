/**
 * Auth de cliente (browser). NO reexportar next/headers aquí.
 * Para RSC / Route Handlers: `import … from '@/features/auth/server'`
 */
export {
  getSessionUser,
  onAuthChange,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
  signOutEverywhere,
  type SessionUser,
} from '@/lib/auth/session';
export { getBrowserSupabase } from '@/lib/auth/browser-client';
export {
  isAdminEmail,
  getAdminEmails,
  isLocalAdminDev,
  isAdminAccessAllowed,
} from '@/lib/auth/admin';
