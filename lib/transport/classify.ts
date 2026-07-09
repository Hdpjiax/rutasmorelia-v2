/**
 * Clasificación de transporte para filtros UI.
 * En datos: "combi" | "foraneo" (y variantes).
 * En UI: Combis vs Autobuses (foráneos).
 */

/** Filtro de producto: combis urbanas vs autobuses (foráneos). */
export type TransportFilter = 'all' | 'combi' | 'autobus';

/** Ids típicos de autobuses foráneos en el catálogo Morelia */
const FORANEO_ID_HINT =
  /(^|-)(charo|atecuaro|arco-san-pedro|arroyo-colorado|chucandiro|coeneo|cointzio|jesus-del-monte|chihuerio|chiquimitio|capula|ciudad-de-hidalgo|centros-comerciales|campestre|canteras|lucio|leandro-valle|indaparapeo|san-antonio-corrales)(-|$)/i;

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function normalizeTransportType(
  raw?: string | null,
  routeId?: string | null,
  routeName?: string | null
): 'combi' | 'autobus' {
  const s = stripAccents(String(raw ?? '')).trim();

  if (
    s === 'foraneo' ||
    s === 'foraneos' ||
    s === 'bus' ||
    s === 'autobus' ||
    s === 'autobuses' ||
    s.includes('foraneo') ||
    s.includes('autobus')
  ) {
    return 'autobus';
  }

  if (s === 'combi' || s === 'combis' || s.includes('combi')) {
    return 'combi';
  }

  const id = stripAccents(String(routeId ?? ''));
  const name = stripAccents(String(routeName ?? ''));

  if (
    id.includes('foraneo') ||
    id.includes('autobus') ||
    name.includes('foraneo') ||
    name.includes('autobus') ||
    FORANEO_ID_HINT.test(id)
  ) {
    return 'autobus';
  }

  // Por defecto: combi (mayoría del catálogo urbano de colores)
  return 'combi';
}

export function transportLabel(kind: 'combi' | 'autobus' | TransportFilter): string {
  if (kind === 'all') return 'Todos';
  if (kind === 'combi') return 'Combis';
  return 'Autobuses';
}

export function transportBadgeClass(kind: 'combi' | 'autobus'): string {
  if (kind === 'combi') {
    return 'bg-violet-50 text-violet-800 border-violet-200';
  }
  return 'bg-sky-50 text-sky-800 border-sky-200';
}

/** Valor canónico para persistir en geojson/index (combi | foraneo). */
export function toStoredTransportType(kind: 'combi' | 'autobus'): 'combi' | 'foraneo' {
  return kind === 'autobus' ? 'foraneo' : 'combi';
}
