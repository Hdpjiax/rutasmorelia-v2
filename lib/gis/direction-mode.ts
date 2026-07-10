/**
 * Corredor canónico + sentidos ida/vuelta.
 *
 * - mirrored: una geometría canónica (ida); vuelta = reverse(ida).
 * - independent: ida y vuelta tienen trazos distintos (one-ways, desvíos).
 *
 * Fase 1: UI muestra un sentido a la vez; mirror en editor; flag en GeoJSON.
 * Fase 2 (futuro): un solo LineString canónico en storage.
 */

export type RouteDirection = 'ida' | 'vuelta';
export type DirectionMode = 'mirrored' | 'independent' | 'dual_ring';

export type LngLat = [number, number];

export interface RouteFeatureProperties {
  direction?: string;
  name?: string;
  directionMode?: DirectionMode;
  [key: string]: unknown;
}

export interface RouteFeature {
  type: 'Feature' | string;
  properties?: RouteFeatureProperties | null;
  geometry?: {
    type?: string;
    coordinates?: LngLat[] | number[][];
  } | null;
}

export interface RouteFeatureCollection {
  type: 'FeatureCollection' | string;
  features?: RouteFeature[];
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Umbral por defecto (m): media de distancias ida ↔ reverse(vuelta) para considerar mirrored. */
export const DEFAULT_MIRROR_THRESHOLD_M = 25;

export function directionOfFeature(f: RouteFeature | null | undefined): string {
  return String(f?.properties?.direction ?? f?.properties?.name ?? '').toLowerCase();
}

export function getDirectionMode(
  geojson: RouteFeatureCollection | null | undefined
): DirectionMode {
  const fromProps = geojson?.properties?.directionMode;
  if (fromProps === 'mirrored' || fromProps === 'independent') return fromProps;

  const feat = (geojson?.features ?? []).find(
    (f) => f?.properties?.directionMode === 'mirrored' || f?.properties?.directionMode === 'independent'
  );
  if (feat?.properties?.directionMode === 'mirrored') return 'mirrored';
  if (feat?.properties?.directionMode === 'independent') return 'independent';

  return 'independent';
}

export function reverseCoordinates(coords: LngLat[]): LngLat[] {
  return coords.map((c) => [c[0], c[1]] as LngLat).reverse();
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function sampleIndices(n: number, maxSamples: number): number[] {
  if (n <= 0) return [];
  if (n <= maxSamples) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < maxSamples; i++) {
    out.push(Math.round((i * (n - 1)) / (maxSamples - 1)));
  }
  return out;
}

/** Distancia media (m) de puntos de A al más cercano en B (muestreado). */
export function meanNearestDistanceMeters(
  a: LngLat[],
  b: LngLat[],
  maxSamples = 40
): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  const aIdx = sampleIndices(a.length, maxSamples);
  let sum = 0;
  for (const i of aIdx) {
    const pt = a[i];
    let best = Infinity;
    // subsample B for speed
    const bStep = Math.max(1, Math.floor(b.length / 80));
    for (let j = 0; j < b.length; j += bStep) {
      const d = haversineMeters(pt, b[j]);
      if (d < best) best = d;
    }
    // always check endpoints of B
    best = Math.min(best, haversineMeters(pt, b[0]), haversineMeters(pt, b[b.length - 1]));
    sum += best;
  }
  return sum / aIdx.length;
}

/**
 * Métrica simétrica: ida vs reverse(vuelta).
 * Si es baja, los trazos son el mismo corredor en sentidos opuestos.
 */
export function mirrorSimilarityMeters(
  ida: LngLat[],
  vuelta: LngLat[]
): number {
  if (ida.length < 2 || vuelta.length < 2) return Infinity;
  const revVuelta = reverseCoordinates(vuelta);
  const d1 = meanNearestDistanceMeters(ida, revVuelta);
  const d2 = meanNearestDistanceMeters(revVuelta, ida);
  return (d1 + d2) / 2;
}

export function detectDirectionMode(
  ida: LngLat[],
  vuelta: LngLat[],
  thresholdM = DEFAULT_MIRROR_THRESHOLD_M
): { mode: DirectionMode; similarityM: number } {
  const similarityM = mirrorSimilarityMeters(ida, vuelta);
  return {
    mode: similarityM <= thresholdM ? 'mirrored' : 'independent',
    similarityM,
  };
}

export function findDirectionFeature(
  geojson: RouteFeatureCollection | null | undefined,
  direction: RouteDirection
): RouteFeature | undefined {
  return (geojson?.features ?? []).find((f) => directionOfFeature(f) === direction);
}

export function getDirectionCoords(
  geojson: RouteFeatureCollection | null | undefined,
  direction: RouteDirection
): LngLat[] {
  const f = findDirectionFeature(geojson, direction);
  const raw = f?.geometry?.coordinates;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => [Number(c[0]), Number(c[1])] as LngLat);
}

/** GeoJSON de preview/mapa: solo un sentido (evita línea doble). */
export function filterGeojsonByDirection(
  geojson: RouteFeatureCollection,
  direction: RouteDirection,
  draftCoords?: LngLat[]
): RouteFeatureCollection {
  const features = (geojson.features ?? [])
    .filter((f) => directionOfFeature(f) === direction)
    .map((f) => {
      if (!draftCoords) return { ...f };
      return {
        ...f,
        geometry: {
          ...f.geometry,
          type: 'LineString',
          coordinates: draftCoords,
        },
      };
    });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Prepara GeoJSON de visualización de una ruta.
 *
 * - dual_ring / both_kml_lines: dibuja LAS DOS líneas reales del KML (como el PDF),
 *   misma color, etiquetas Ida y Vuelta en cada sentido real.
 * - mirrored (vuelta≈reverse(ida)): una sola geometría + sense-labels.
 * - independent: ambas líneas reales (como dual_ring).
 */
export function toSingleCorridorDisplay(
  geojson: RouteFeatureCollection,
  options?: {
    color?: string;
    casingColor?: string;
    preferDirection?: RouteDirection;
    role?: string;
  }
): RouteFeatureCollection {
  const ida = findDirectionFeature(geojson, 'ida');
  const vuelta = findDirectionFeature(geojson, 'vuelta');
  const idaCoords = getDirectionCoords(geojson, 'ida');
  const vueltaCoords = getDirectionCoords(geojson, 'vuelta');
  const mode =
    String(
      geojson.properties?.directionMode ??
        ida?.properties?.directionMode ??
        vuelta?.properties?.directionMode ??
        geojson.properties?.corridor ??
        ''
    ).toLowerCase();
  const corridor = String(
    geojson.properties?.corridor ?? ida?.properties?.corridor ?? ''
  ).toLowerCase();

  const color =
    options?.color ||
    String(ida?.properties?.color || vuelta?.properties?.color || '#3b82f6');
  const casingColor =
    options?.casingColor ||
    String(ida?.properties?.casingColor || vuelta?.properties?.casingColor || '#222222');
  const role = options?.role ?? 'full';

  // PDF dual (anillo ida+vuelta reales): dibujar ambas
  const drawBoth =
    mode === 'dual_ring' ||
    mode === 'independent' ||
    corridor === 'both_kml_lines' ||
    corridor === 'dual_ring' ||
    (idaCoords.length >= 2 &&
      vueltaCoords.length >= 2 &&
      // si no es reverse exacto, son dos trazos reales
      JSON.stringify(vueltaCoords) !== JSON.stringify(reverseCoordinates(idaCoords)));

  if (drawBoth && idaCoords.length >= 2 && vueltaCoords.length >= 2) {
    return {
      type: 'FeatureCollection',
      properties: {
        ...(geojson.properties ?? {}),
        directionMode: 'dual_ring',
        corridor: 'both_kml_lines',
      },
      features: [
        {
          type: 'Feature',
          properties: {
            ...(ida?.properties ?? {}),
            type: 'ride',
            role,
            direction: 'ida',
            name: 'Ida',
            color,
            casingColor,
            directionMode: 'dual_ring',
          },
          geometry: { type: 'LineString', coordinates: idaCoords },
        },
        {
          type: 'Feature',
          properties: {
            ...(vuelta?.properties ?? {}),
            type: 'ride',
            role,
            direction: 'vuelta',
            name: 'Vuelta',
            color,
            casingColor,
            directionMode: 'dual_ring',
          },
          geometry: { type: 'LineString', coordinates: vueltaCoords },
        },
      ],
    };
  }

  // Corredor único (vuelta = reverse): 1 línea + etiquetas de sentido
  let corridorCoords: LngLat[] = [];
  let baseProps: RouteFeatureProperties = {};

  const prefer = options?.preferDirection;
  if (prefer === 'vuelta' && vueltaCoords.length >= 2) {
    corridorCoords = vueltaCoords;
    baseProps = { ...(vuelta?.properties ?? {}) };
  } else if (idaCoords.length >= 2) {
    corridorCoords = idaCoords;
    baseProps = { ...(ida?.properties ?? {}) };
  } else if (vueltaCoords.length >= 2) {
    corridorCoords = vueltaCoords;
    baseProps = { ...(vuelta?.properties ?? {}) };
  } else {
    const first = (geojson.features ?? []).find(
      (f) => f.geometry?.type === 'LineString' && (f.geometry.coordinates?.length ?? 0) >= 2
    );
    if (first?.geometry?.coordinates) {
      corridorCoords = first.geometry.coordinates.map(
        (c) => [Number(c[0]), Number(c[1])] as LngLat
      );
      baseProps = { ...(first.properties ?? {}) };
    }
  }

  if (corridorCoords.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  const rev = reverseCoordinates(corridorCoords);

  return {
    type: 'FeatureCollection',
    properties: {
      ...(geojson.properties ?? {}),
      directionMode: 'mirrored',
    },
    features: [
      {
        type: 'Feature',
        properties: {
          ...baseProps,
          type: 'ride',
          role,
          directionMode: 'mirrored',
          color,
          casingColor,
          name: '',
          direction: 'corridor',
        },
        geometry: { type: 'LineString', coordinates: corridorCoords },
      },
      {
        type: 'Feature',
        properties: {
          type: 'sense-label',
          name: 'Ida',
          direction: 'ida',
          color,
          casingColor,
          directionMode: 'mirrored',
        },
        geometry: { type: 'LineString', coordinates: corridorCoords },
      },
      {
        type: 'Feature',
        properties: {
          type: 'sense-label',
          name: 'Vuelta',
          direction: 'vuelta',
          color,
          casingColor,
          directionMode: 'mirrored',
        },
        geometry: { type: 'LineString', coordinates: rev },
      },
    ],
  };
}

/** Aplica directionMode a collection + cada feature. */
export function stampDirectionMode(
  geojson: RouteFeatureCollection,
  mode: DirectionMode
): RouteFeatureCollection {
  const next: RouteFeatureCollection = {
    ...geojson,
    type: 'FeatureCollection',
    properties: {
      ...(geojson.properties ?? {}),
      directionMode: mode,
    },
    features: (geojson.features ?? []).map((f) => ({
      ...f,
      properties: {
        ...(f.properties ?? {}),
        directionMode: mode,
      },
    })),
  };
  return next;
}

/**
 * Copia coordenadas de `from` a `to` como reverse.
 * Crea feature de destino si no existe (clonando props del origen).
 */
export function mirrorDirection(
  geojson: RouteFeatureCollection,
  from: RouteDirection,
  to: RouteDirection
): RouteFeatureCollection {
  const next = JSON.parse(JSON.stringify(geojson)) as RouteFeatureCollection;
  const source = findDirectionFeature(next, from);
  if (!source?.geometry?.coordinates || source.geometry.coordinates.length < 2) {
    return stampDirectionMode(next, 'mirrored');
  }

  const coords = reverseCoordinates(
    source.geometry.coordinates.map((c) => [Number(c[0]), Number(c[1])] as LngLat)
  );

  let targetIdx = (next.features ?? []).findIndex((f) => directionOfFeature(f) === to);
  if (targetIdx < 0) {
    const clone: RouteFeature = JSON.parse(JSON.stringify(source));
    clone.properties = {
      ...(clone.properties ?? {}),
      direction: to,
      name: to === 'ida' ? 'Ida' : 'Vuelta',
    };
    clone.geometry = { type: 'LineString', coordinates: coords };
    next.features = [...(next.features ?? []), clone];
  } else {
    const t = next.features![targetIdx];
    t.geometry = {
      ...(t.geometry ?? {}),
      type: 'LineString',
      coordinates: coords,
    };
    t.properties = {
      ...(t.properties ?? {}),
      direction: to,
      name: to === 'ida' ? 'Ida' : 'Vuelta',
    };
  }

  return stampDirectionMode(next, 'mirrored');
}

/**
 * Tras editar un sentido en modo mirrored, sincroniza el opuesto = reverse(editado).
 * En independent solo actualiza el sentido editado.
 */
export function applyEditedDirection(
  geojson: RouteFeatureCollection,
  direction: RouteDirection,
  coords: LngLat[],
  options?: {
    /** true: siempre reverse al otro; false: nunca; omitido: si mode=mirrored */
    forceMirrorSync?: boolean;
  }
): RouteFeatureCollection {
  const next = JSON.parse(JSON.stringify(geojson)) as RouteFeatureCollection;
  const mode = getDirectionMode(next);
  // forceMirrorSync: true → siempre; false → nunca; undefined → si mode=mirrored
  const syncMirror =
    options?.forceMirrorSync === true ||
    (options?.forceMirrorSync !== false && mode === 'mirrored');

  let idx = (next.features ?? []).findIndex((f) => directionOfFeature(f) === direction);
  if (idx < 0) {
    // crear feature mínima
    next.features = next.features ?? [];
    next.features.push({
      type: 'Feature',
      properties: {
        direction,
        name: direction === 'ida' ? 'Ida' : 'Vuelta',
        directionMode: syncMirror ? 'mirrored' : mode,
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  } else {
    next.features![idx].geometry = {
      ...(next.features![idx].geometry ?? {}),
      type: 'LineString',
      coordinates: coords,
    };
    next.features![idx].properties = {
      ...(next.features![idx].properties ?? {}),
      direction,
      name: direction === 'ida' ? 'Ida' : 'Vuelta',
    };
  }

  if (syncMirror && coords.length >= 2) {
    const other: RouteDirection = direction === 'ida' ? 'vuelta' : 'ida';
    return mirrorDirection(next, direction, other);
  }

  return stampDirectionMode(next, mode);
}

/** Detecta y sella directionMode en un FeatureCollection con ida+vuelta. */
export function annotateDirectionMode(
  geojson: RouteFeatureCollection,
  thresholdM = DEFAULT_MIRROR_THRESHOLD_M
): { geojson: RouteFeatureCollection; mode: DirectionMode; similarityM: number } {
  const ida = getDirectionCoords(geojson, 'ida');
  const vuelta = getDirectionCoords(geojson, 'vuelta');
  const { mode, similarityM } = detectDirectionMode(ida, vuelta, thresholdM);
  return {
    geojson: stampDirectionMode(geojson, mode),
    mode,
    similarityM,
  };
}
