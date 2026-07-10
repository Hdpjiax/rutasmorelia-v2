/** Normaliza texto para búsqueda: minúsculas, sin acentos, sin basura. */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens útiles de una consulta (sin stopwords cortas). */
export function searchTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((t) => t.length >= 1 && t !== 'ruta' && t !== 'de' && t !== 'la' && t !== 'el');
}
