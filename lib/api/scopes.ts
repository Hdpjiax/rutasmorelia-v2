/**
 * Separación conceptual de APIs:
 *
 * USER (público / sesión de usuario final)
 * - GET /api/geocode         → autocompletado de lugares (Nominatim + bbox Morelia)
 * - Favoritos / auth         → cliente Supabase (RLS), no van por /api/*
 *
 * ADMIN (middleware: sesión + ADMIN_EMAILS)
 * - /api/qa/*                → reportes, geojson, match, save, delete, Valhalla ready
 * - En Vercel, match/save/DELETE → 501 (ADMIN_LOCAL_ONLY)
 *
 * Páginas:
 * - /                        → producto
 * - /admin/qa                → panel QA (protegido)
 */

export const API_USER_PREFIXES = ['/api/geocode'] as const;
export const API_ADMIN_PREFIXES = ['/api/qa'] as const;
