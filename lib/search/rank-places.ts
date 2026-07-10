import type { PlaceHit } from './morelia-places';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ranking de sugerencias de dirección:
 * 1) coincidencia exacta del nombre
 * 2) empieza con la query / palabra exacta
 * 3) contiene la query
 * 4) favoritos y catálogo con leve boost
 * Los favoritos NO empujan una coincidencia exacta al fondo.
 */
export function scoreHitForQuery(hit: PlaceHit, query: string): number {
  const q = normalize(query);
  if (!q) return hit.source === 'favorite' ? 100 : 0;

  const name = normalize(hit.name);
  const desc = normalize(hit.description || '');
  const words = name.split(' ').filter(Boolean);
  let score = 0;

  if (name === q) score += 50_000;
  else if (name.startsWith(q + ' ') || name.startsWith(q)) score += 40_000;
  else if (words.some((w) => w === q)) score += 35_000;
  else if (words.some((w) => w.startsWith(q))) score += 28_000;
  else if (name.includes(q)) score += 20_000;
  else if (desc.includes(q)) score += 8_000;

  // Tokens de la query (todas deben ayudar)
  const qTokens = q.split(' ').filter((t) => t.length >= 2);
  if (qTokens.length > 1) {
    let hits = 0;
    for (const t of qTokens) {
      if (name.includes(t) || desc.includes(t)) hits++;
    }
    score += (hits / qTokens.length) * 12_000;
    // Bonus si el nombre empieza con el primer token
    if (name.startsWith(qTokens[0])) score += 3_000;
  }

  // Preferir nombres más cortos cuando el score base es similar (match más “puro”)
  if (score >= 20_000) {
    score += Math.max(0, 80 - name.length);
  }

  // Boosts de origen (nunca superan un exact match)
  if (hit.source === 'favorite' || hit.isFavorite) score += 400;
  if (hit.source === 'catalog') score += 80;
  if (hit.source === 'geocode') score += 40;

  return score;
}

function dedupeKey(h: PlaceHit): string {
  const n = normalize(h.name);
  return `${n}|${h.coordinates[0].toFixed(4)},${h.coordinates[1].toFixed(4)}`;
}

/** Fusiona catálogo + geocode + favoritos y ordena por relevancia a la query. */
export function mergeAndRankPlaces(
  parts: PlaceHit[][],
  query: string,
  limit = 24
): PlaceHit[] {
  const map = new Map<string, PlaceHit>();
  for (const list of parts) {
    for (const h of list) {
      const k = dedupeKey(h);
      const prev = map.get(k);
      if (!prev) {
        map.set(k, h);
        continue;
      }
      // Conservar el de mejor score / preferir favorite
      const sNew = scoreHitForQuery(h, query);
      const sOld = scoreHitForQuery(prev, query);
      if (sNew > sOld) map.set(k, h);
      else if (
        sNew === sOld &&
        (h.source === 'favorite' || h.isFavorite) &&
        prev.source !== 'favorite'
      ) {
        map.set(k, { ...h, isFavorite: true });
      }
    }
  }

  return Array.from(map.values())
    .map((h) => ({ h, s: scoreHitForQuery(h, query) }))
    .filter((x) => x.s > 0 || !query.trim())
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.h);
}
