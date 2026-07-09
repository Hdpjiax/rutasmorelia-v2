import { Route } from '../supabase/client';

/**
 * Calculates the Levenshtein distance between two strings.
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
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Performs a genuine case-insensitive fuzzy and substring search on routes.
 * It ranks routes based on exact match, substring inclusion, and fuzzy edit distance.
 */
export function fuzzySearchRoutes(routes: Route[], query: string): Route[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return routes;

  const scored = routes.map((route) => {
    const name = route.name.toLowerCase();
    const desc = (route.description || '').toLowerCase();
    let score = 0;

    // 1. Exact matches
    if (name === cleanQuery) {
      score += 100;
    } else if (name.startsWith(cleanQuery)) {
      // 2. Starts with query
      score += 50;
    } else if (name.includes(cleanQuery)) {
      // 3. Substring inclusion
      score += 30;
    } else if (desc.includes(cleanQuery)) {
      score += 15;
    }

    // 4. Fuzzy distance matching for small query lengths or close matches
    // Compare query with each word in the route name
    const words = name.split(/\s+/);
    let minWordDistance = Infinity;
    for (const word of words) {
      if (word === 'ruta' && cleanQuery !== 'ruta') continue;
      if (word.length >= 3 && cleanQuery.length >= 3) {
        const dist = getLevenshteinDistance(cleanQuery, word);
        if (dist < minWordDistance) {
          minWordDistance = dist;
        }
      }
    }

    if (minWordDistance <= 2) {
      score += (3 - minWordDistance) * 10;
    }

    return { route, score };
  });

  // Filter out those with zero score and sort by score descending
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.route);
}
