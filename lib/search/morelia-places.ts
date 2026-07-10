/**
 * Catálogo local de lugares y colonias de Morelia + búsqueda fuzzy.
 * Complementado en runtime con geocoding OSM (Nominatim) vía /api/geocode.
 */

export type PlaceHit = {
  id: string;
  name: string;
  description?: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  source: 'catalog' | 'geocode' | 'gps' | 'favorite';
  isFavorite?: boolean;
};

/** Bbox aproximado del área metropolitana de Morelia (west, south, east, north). */
export const MORELIA_BBOX = {
  west: -101.35,
  south: 19.55,
  east: -101.05,
  north: 19.85,
} as const;

const CATALOG: Omit<PlaceHit, 'source'>[] = [
  // Centro histórico y puntos emblemáticos
  { id: 'cat-catedral', name: 'Catedral de Morelia', description: 'Centro Histórico', category: 'landmark', coordinates: [-101.1944, 19.7026] },
  { id: 'cat-centro', name: 'Centro Histórico', description: 'Centro de Morelia', category: 'area', coordinates: [-101.194, 19.702] },
  { id: 'cat-zocalo', name: 'Zócalo / Plaza de Armas', description: 'Centro Histórico', category: 'landmark', coordinates: [-101.1948, 19.7028] },
  { id: 'cat-acueducto', name: 'Acueducto de Morelia', description: 'Calzada Fray Antonio de San Miguel', category: 'landmark', coordinates: [-101.1805, 19.7012] },
  { id: 'cat-calzada', name: 'Calzada Fray Antonio de San Miguel', description: 'Centro', category: 'street', coordinates: [-101.182, 19.701] },
  { id: 'cat-casa-cultura', name: 'Casa de la Cultura', description: 'Centro Histórico', category: 'culture', coordinates: [-101.1905, 19.7005] },
  { id: 'cat-palacio-gobierno', name: 'Palacio de Gobierno', description: 'Centro Histórico', category: 'landmark', coordinates: [-101.1935, 19.7032] },
  { id: 'cat-mercado-san-juan', name: 'Mercado San Juan', description: 'Centro', category: 'market', coordinates: [-101.198, 19.701] },
  { id: 'cat-mercado-independencia', name: 'Mercado Independencia', description: 'Centro', category: 'market', coordinates: [-101.188, 19.698] },
  { id: 'cat-alameda', name: 'Alameda de Morelia', description: 'Parque centro', category: 'park', coordinates: [-101.186, 19.704] },
  { id: 'cat-bosque-cuauhtemoc', name: 'Bosque Cuauhtémoc', description: 'Parque urbano', category: 'park', coordinates: [-101.182, 19.695] },
  { id: 'cat-zoo', name: 'Zoológico de Morelia', description: 'Zoológico Benito Juárez', category: 'park', coordinates: [-101.196, 19.682] },
  { id: 'cat-orquidario', name: 'Orquidario de Morelia', description: 'Parque Zoológico', category: 'park', coordinates: [-101.197, 19.681] },
  { id: 'cat-estadio', name: 'Estadio Morelos', description: 'Colonia Chapultepec Sur', category: 'sports', coordinates: [-101.208, 19.678] },
  { id: 'cat-umsn', name: 'Universidad Michoacana (UMSNH)', description: 'Ciudad Universitaria', category: 'education', coordinates: [-101.185, 19.687] },
  { id: 'cat-tecnologico', name: 'Instituto Tecnológico de Morelia', description: 'ITM', category: 'education', coordinates: [-101.185, 19.716] },
  { id: 'cat-tec-monterrey', name: 'Tec de Monterrey Campus Morelia', description: 'Educación', category: 'education', coordinates: [-101.17, 19.69] },
  { id: 'cat-hospital-civil', name: 'Hospital Civil de Morelia', description: 'Salud', category: 'health', coordinates: [-101.19, 19.695] },
  { id: 'cat-issste', name: 'Hospital ISSSTE Morelia', description: 'Salud', category: 'health', coordinates: [-101.175, 19.71] },
  { id: 'cat-imss', name: 'IMSS Hospital General Regional', description: 'Salud', category: 'health', coordinates: [-101.205, 19.71] },
  { id: 'cat-central-camiones', name: 'Central de Autobuses de Morelia', description: 'Transporte foráneo', category: 'transport', coordinates: [-101.178, 19.685] },
  { id: 'cat-aeropuerto', name: 'Aeropuerto Internacional de Morelia', description: 'Gral. Francisco J. Múgica', category: 'transport', coordinates: [-101.025, 19.85] },
  // Colonias / zonas
  { id: 'cat-chapultepec', name: 'Colonia Chapultepec', description: 'Morelia', category: 'colonia', coordinates: [-101.205, 19.685] },
  { id: 'cat-felix-ireta', name: 'Colonia Félix Ireta', description: 'Morelia', category: 'colonia', coordinates: [-101.195, 19.69] },
  { id: 'cat-ventura-puente', name: 'Colonia Ventura Puente', description: 'Morelia', category: 'colonia', coordinates: [-101.19, 19.69] },
  { id: 'cat-molino', name: 'Colonia El Molino', description: 'Morelia', category: 'colonia', coordinates: [-101.21, 19.7] },
  { id: 'cat-lomas-morelia', name: 'Lomas de Morelia', description: 'Morelia', category: 'colonia', coordinates: [-101.22, 19.72] },
  { id: 'cat-satelite', name: 'Colonia Satélite', description: 'Morelia', category: 'colonia', coordinates: [-101.23, 19.71] },
  { id: 'cat-torreon', name: 'Torreón Nuevo', description: 'Morelia', category: 'colonia', coordinates: [-101.17, 19.72] },
  { id: 'cat-trincheras', name: 'Trincheras', description: 'Morelia', category: 'colonia', coordinates: [-101.16, 19.73] },
  { id: 'cat-santa-maria', name: 'Santa María de Guido', description: 'Morelia', category: 'colonia', coordinates: [-101.17, 19.68] },
  { id: 'cat-erandeni', name: 'Erandeni', description: 'Morelia', category: 'colonia', coordinates: [-101.15, 19.69] },
  { id: 'cat-metropolis', name: 'Metrópolis', description: 'Plaza / zona comercial', category: 'mall', coordinates: [-101.21, 19.71] },
  { id: 'cat-galerias', name: 'Galerías Morelia', description: 'Centro comercial', category: 'mall', coordinates: [-101.195, 19.72] },
  { id: 'cat-plaza-fiesta', name: 'Plaza Fiesta Camelinas', description: 'Centro comercial', category: 'mall', coordinates: [-101.2, 19.685] },
  { id: 'cat-soriana-camelinas', name: 'Soriana Camelinas', description: 'Comercio', category: 'shop', coordinates: [-101.198, 19.686] },
  { id: 'cat-walmart', name: 'Walmart Morelia', description: 'Comercio', category: 'shop', coordinates: [-101.19, 19.72] },
  { id: 'cat-costco', name: 'Costco Morelia', description: 'Comercio', category: 'shop', coordinates: [-101.21, 19.705] },
  { id: 'cat-puerta-sol', name: 'Puerta del Sol', description: 'Zona residencial', category: 'colonia', coordinates: [-101.14, 19.7] },
  { id: 'cat-lomas-universidad', name: 'Lomas de la Universidad', description: 'Morelia', category: 'colonia', coordinates: [-101.18, 19.68] },
  { id: 'cat-independencia', name: 'Colonia Independencia', description: 'Morelia', category: 'colonia', coordinates: [-101.2, 19.71] },
  { id: 'cat-electricistas', name: 'Colonia Electricistas', description: 'Morelia', category: 'colonia', coordinates: [-101.21, 19.69] },
  { id: 'cat-prados-verdes', name: 'Prados Verdes', description: 'Morelia', category: 'colonia', coordinates: [-101.24, 19.7] },
  { id: 'cat-mision-valle', name: 'Misión del Valle', description: 'Morelia', category: 'colonia', coordinates: [-101.23, 19.69] },
  { id: 'cat-villla-universidad', name: 'Villa Universidad', description: 'Morelia', category: 'colonia', coordinates: [-101.185, 19.685] },
  { id: 'cat-lazaro', name: 'Lázaro Cárdenas (Periférico)', description: 'Av. Lázaro Cárdenas', category: 'street', coordinates: [-101.2, 19.7] },
  { id: 'cat-madero', name: 'Avenida Francisco I. Madero', description: 'Centro', category: 'street', coordinates: [-101.192, 19.702] },
  { id: 'cat-garcia-obeso', name: 'Avenida García de Obeso', description: 'Centro', category: 'street', coordinates: [-101.196, 19.701] },
  { id: 'cat-camelinas', name: 'Avenida Camelinas', description: 'Sur de Morelia', category: 'street', coordinates: [-101.195, 19.685] },
  { id: 'cat-periodismo', name: 'Avenida del Periodismo', description: 'Morelia', category: 'street', coordinates: [-101.205, 19.7] },
  { id: 'cat-santiago', name: 'Santiago Undameo', description: 'Tenencia', category: 'area', coordinates: [-101.28, 19.65] },
  { id: 'cat-jesus-monte', name: 'Jesús del Monte', description: 'Tenencia', category: 'area', coordinates: [-101.15, 19.65] },
  { id: 'cat-cointzio', name: 'Cointzio', description: 'Tenencia', category: 'area', coordinates: [-101.25, 19.63] },
  { id: 'cat-charo', name: 'Charo', description: 'Municipio vecino', category: 'area', coordinates: [-101.05, 19.75] },
  { id: 'cat-tarimbaro', name: 'Tarímbaro', description: 'Municipio vecino', category: 'area', coordinates: [-101.13, 19.8] },
  { id: 'cat-alberca', name: 'Alberca Olímpica / Metrópolis', description: 'Deportes / zona norte', category: 'sports', coordinates: [-101.215, 19.72] },
  { id: 'cat-palacio-clavas', name: 'Palacio del Arte', description: 'Cultura', category: 'culture', coordinates: [-101.185, 19.702] },
  { id: 'cat-teatro-ocampo', name: 'Teatro Ocampo', description: 'Centro Histórico', category: 'culture', coordinates: [-101.193, 19.7015] },
  { id: 'cat-biblioteca', name: 'Biblioteca Pública Universitaria', description: 'Centro', category: 'culture', coordinates: [-101.191, 19.701] },
  { id: 'cat-plaza-revolucion', name: 'Plaza Morelos / Revolución', description: 'Centro', category: 'park', coordinates: [-101.185, 19.703] },
  { id: 'cat-tres-puentes', name: 'Tres Puentes', description: 'Zona', category: 'area', coordinates: [-101.16, 19.71] },
  { id: 'cat-la-soledad', name: 'La Soledad', description: 'Colonia / zona', category: 'colonia', coordinates: [-101.14, 19.72] },
  { id: 'cat-issste-soledad', name: 'ISSSTE / La Soledad', description: 'Zona oriente', category: 'area', coordinates: [-101.15, 19.715] },
  { id: 'cat-villas-sol', name: 'Villas del Sol', description: 'Colonia', category: 'colonia', coordinates: [-101.22, 19.68] },
  { id: 'cat-oken', name: 'Oken / zona industrial', description: 'Morelia', category: 'area', coordinates: [-101.24, 19.72] },
  { id: 'cat-manantiales', name: 'Manantiales', description: 'Colonia', category: 'colonia', coordinates: [-101.21, 19.68] },
  { id: 'cat-eduardo-ruiz', name: 'Parque Eduardo Ruiz', description: 'Parque', category: 'park', coordinates: [-101.188, 19.705] },
  { id: 'cat-jardin-rosas', name: 'Jardín de las Rosas', description: 'Centro Histórico', category: 'park', coordinates: [-101.193, 19.704] },
  { id: 'cat-plaza-valladolid', name: 'Plaza Valladolid', description: 'Centro comercial', category: 'mall', coordinates: [-101.2, 19.71] },
  { id: 'cat-arco-san-pedro', name: 'Arcos de San Pedro', description: 'Zona', category: 'area', coordinates: [-101.17, 19.69] },
  { id: 'cat-atecuaro', name: 'Atécuaro', description: 'Comunidad', category: 'area', coordinates: [-101.22, 19.62] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function scorePlace(query: string, place: Omit<PlaceHit, 'source'>): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(place.name);
  const desc = normalize(place.description || '');
  const cat = normalize(place.category);
  let score = 0;

  if (name === q) score += 120;
  else if (name.startsWith(q)) score += 80;
  else if (name.includes(q)) score += 55;
  else if (desc.includes(q)) score += 35;
  else if (cat.includes(q)) score += 20;

  // tokens: "centro historico" vs "centro"
  const qTokens = q.split(/\s+/).filter(Boolean);
  const nameTokens = name.split(/\s+/);
  let tokenHits = 0;
  for (const t of qTokens) {
    if (t.length < 2) continue;
    if (nameTokens.some((n) => n.startsWith(t) || n.includes(t))) tokenHits++;
    else if (desc.includes(t)) tokenHits += 0.5;
  }
  if (qTokens.length) score += (tokenHits / qTokens.length) * 40;

  // fuzzy word distance
  for (const word of nameTokens) {
    if (word.length < 3 || q.length < 3) continue;
    if (word.includes(q) || q.includes(word)) {
      score += 15;
      break;
    }
    // simple edit: same start 3 chars
    if (word.slice(0, 3) === q.slice(0, 3)) score += 8;
  }

  return score;
}

/** Busca en el catálogo local. */
export function searchLocalPlaces(query: string, limit = 12): PlaceHit[] {
  const q = query.trim();
  if (!q) {
    return CATALOG.slice(0, limit).map((p) => ({ ...p, source: 'catalog' as const }));
  }

  return CATALOG.map((p) => ({ place: p, score: scorePlace(q, p) }))
    .filter((x) => x.score > 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({ ...x.place, source: 'catalog' as const }));
}

export function getCatalogSize(): number {
  return CATALOG.length;
}
