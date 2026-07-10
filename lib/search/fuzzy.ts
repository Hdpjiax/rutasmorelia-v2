import Fuse from 'fuse.js';
import type { Route } from '../supabase/client';
import { normalizeSearchText, searchTokens } from './normalize';
import { parseRouteDisplay } from '@/lib/routes/route-display';

/**
 * Calcula la distancia de Levenshtein entre dos strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/** Alias / abreviaturas frecuentes en Morelia (query → términos a expandir). */
const QUERY_ALIASES: Record<string, string[]> = {
  morda: ['morada'],
  moraa: ['morada'],
  cam: ['camelinas'],
  camel: ['camelinas'],
  centro: ['centro', 'catedral', 'historico'],
  zocalo: ['centro', 'plaza de armas'],
  metropolis: ['metropolis', 'alberca'],
  metro: ['metropolis'],
  issste: ['issste', 'soledad'],
  umich: ['universidad', 'umsn'],
  umsn: ['universidad', 'umsn'],
  tec: ['tecnologico', 'itm'],
  foraneo: ['foraneo', 'autobus', 'camion'],
  camion: ['autobus', 'foraneo'],
  bus: ['autobus', 'foraneo'],
  combi: ['combi'],
  naranj: ['naranja'],
  amaril: ['amarilla'],
  guinda: ['guinda'],
  griss: ['gris'],
  prados: ['prados verdes'],
};

function expandQuery(query: string): string {
  const n = normalizeSearchText(query);
  const tokens = searchTokens(n);
  const expanded = new Set<string>([n, ...tokens]);
  for (const t of tokens) {
    for (const [alias, targets] of Object.entries(QUERY_ALIASES)) {
      if (t === alias || t.startsWith(alias) || (alias.startsWith(t) && t.length >= 3)) {
        targets.forEach((x) => expanded.add(x));
      }
    }
    // typo corto: prefijo de color (morda → morada)
    if (t.length >= 4) {
      for (const color of [
        'morada',
        'naranja',
        'amarilla',
        'roja',
        'gris',
        'guinda',
        'coral',
        'cafe',
        'verde',
        'azul',
      ]) {
        if (getLevenshteinDistance(t, color) <= 2) expanded.add(color);
      }
    }
  }
  return Array.from(expanded).join(' ');
}

type RouteSearchRow = Route & {
  _normName: string;
  _blob: string;
  _baseName: string;
  _corridors: string;
};

function toSearchRow(route: Route): RouteSearchRow {
  const display = parseRouteDisplay(route);
  const blob = normalizeSearchText(
    `${display.searchBlob} ${route.color || ''} ${route.transport_type || ''}`
  );
  return {
    ...route,
    _normName: normalizeSearchText(route.name),
    _blob: blob,
    _baseName: normalizeSearchText(display.baseName),
    _corridors: normalizeSearchText(display.corridorLabel),
  };
}

/**
 * Búsqueda tolerante de rutas: sin acentos, typos, abreviaturas, colores, colonias.
 * Usa Fuse.js + scoring manual.
 */
export function fuzzySearchRoutes(routes: Route[], query: string): Route[] {
  const cleanQuery = query.trim();
  if (!cleanQuery) return routes;

  const expanded = expandQuery(cleanQuery);
  const rows = routes.map(toSearchRow);

  const fuse = new Fuse(rows, {
    keys: [
      { name: '_normName', weight: 0.45 },
      { name: '_baseName', weight: 0.25 },
      { name: '_corridors', weight: 0.25 },
      { name: '_blob', weight: 0.05 },
    ],
    // Más estricto: evita que "roja" ≈ "ruta"
    threshold: 0.32,
    ignoreLocation: true,
    minMatchCharLength: 3,
    includeScore: true,
  });

  const fuseHits = fuse.search(expanded);
  const byId = new Map<string, number>();

  for (const hit of fuseHits) {
    const score = 1 - (hit.score ?? 1); // higher better
    byId.set(hit.item.id, Math.max(byId.get(hit.item.id) ?? 0, score * 100));
  }

  // Scoring manual adicional (substring, tokens, levenshtein en palabras)
  const qNorm = normalizeSearchText(cleanQuery);
  const tokens = searchTokens(expanded).filter((t) => t !== 'ruta' && t !== 'combi');

  for (const row of rows) {
    let score = byId.get(row.id) ?? 0;
    if (row._normName === qNorm) score += 120;
    else if (row._normName.startsWith(qNorm)) score += 70;
    else if (row._normName.includes(qNorm)) score += 55;
    else if (row._corridors.includes(qNorm)) score += 40;
    else if (row._blob.includes(qNorm) && qNorm.length >= 4) score += 20;

    let tokenHits = 0;
    for (const t of tokens) {
      if (t.length < 2) continue;
      if (row._normName.includes(t) || row._corridors.includes(t)) {
        tokenHits += 1.2;
        continue;
      }
      if (row._blob.includes(t) && t.length >= 4) {
        tokenHits += 0.6;
        continue;
      }
      // Fuzzy solo en palabras significativas (no "ruta")
      for (const w of row._normName.split(/\s+/)) {
        if (w === 'ruta' || w.length < 4 || t.length < 4) continue;
        const maxDist = t.length <= 5 ? 1 : 2;
        if (getLevenshteinDistance(t, w) <= maxDist) {
          tokenHits += 0.9;
          break;
        }
      }
    }
    if (tokens.length) score += (tokenHits / tokens.length) * 50;

    // número de ruta: "1", "2a" — solo refuerza, no basta solo
    const num = qNorm.match(/\b(\d+[a-z]?)\b/);
    if (num && row._normName.includes(num[1]) && score > 0) score += 15;

    if (score > 0) byId.set(row.id, score);
  }

  const ranked = routes
    .map((r) => ({ route: r, score: byId.get(r.id) ?? 0 }))
    .filter((x) => x.score > 18)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.route);

  return ranked;
}
