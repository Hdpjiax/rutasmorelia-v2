import {
  getHaversineDistance,
  mockDb,
  projectPointOntoLineString,
} from '../supabase/client';
import type { PublishedShape } from './load-published-shapes';

export type Coordinate = [number, number]; // [lng, lat]

export interface PlannerPreferences {
  maxWalkDistanceMeters?: number; // default 900m
  allowTransfers?: boolean; // default true
  walkSpeedMeterPerSec?: number; // default 1.2 m/s
  transitSpeedMeterPerSec?: number; // default 6.1 m/s
  /** Shapes publicadas; si no se pasan, no hay red (devuelve []). */
  shapes?: PublishedShape[];
  /**
   * Si true: solo calcula transbordos cuando no hay directos útiles.
   * Default false: el usuario ve directos y transbordos juntos.
   */
  transferOnlyIfNecessary?: boolean;
  maxDirectWalkTotalM?: number;
  /** Máx. opciones directas en la lista (default 6) */
  maxDirectPlans?: number;
  /** Máx. opciones con transbordo en la lista (default 6) */
  maxTransferPlans?: number;
}

export interface TravelSegment {
  type: 'walk' | 'ride';
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  routeId?: string;
  routeName?: string;
  color?: string;
  direction?: 'ida' | 'vuelta';
  boardingPoint?: Coordinate;
  alightingPoint?: Coordinate;
  /** Para walk: extremos de la línea punteada (camino más corto a pie) */
  walkFrom?: Coordinate;
  walkTo?: Coordinate;
  walkKind?: 'to_board' | 'from_alight' | 'transfer';
}

export interface TripPlan {
  type: 'direct' | 'transfer';
  segments: TravelSegment[];
  boardingPoint: Coordinate;
  alightingPoint: Coordinate;
  totalDistance: number;
  totalDuration: number;
  walkDistanceTotal: number;
}

type AccessPoint = {
  point: Coordinate;
  /** Distancia a pie desde origen o destino */
  walkM: number;
  /** Fracción 0–1 a lo largo de la ruta */
  fraction: number;
  /** Índice de muestreo en la polyline */
  sampleIndex: number;
};

type BoardAlightPair = {
  board: AccessPoint;
  alight: AccessPoint;
  walkTotal: number;
  rideM: number;
};

/**
 * Planifica origen→destino con rutas publicadas.
 * Sube/Baja se eligen para minimizar caminata (líneas punteadas más cortas).
 * Prioriza directos; transbordos solo si no hay directo viable.
 */
export async function planTrip(
  origin: Coordinate,
  destination: Coordinate,
  preferences: PlannerPreferences = {}
): Promise<TripPlan[]> {
  const maxWalkDist = preferences.maxWalkDistanceMeters ?? 900;
  const allowTransfers = preferences.allowTransfers ?? true;
  // ~4.3 km/h a pie (incluye cruces); ~22 km/h combi en ciudad
  const walkSpeed = preferences.walkSpeedMeterPerSec ?? 1.2;
  const transitSpeed = preferences.transitSpeedMeterPerSec ?? 6.1;
  // Por defecto SIEMPRE calcular transbordos (el usuario debe ver ambas familias)
  const transferOnlyIfNecessary = preferences.transferOnlyIfNecessary ?? false;
  const maxDirectWalkTotal = preferences.maxDirectWalkTotalM ?? 1600;
  const maxDirectPlans = preferences.maxDirectPlans ?? 6;
  const maxTransferPlans = preferences.maxTransferPlans ?? 6;

  let shapes: PublishedShape[] = preferences.shapes ?? [];
  if (shapes.length === 0) {
    shapes = mockDb.route_shapes
      .filter((s) => s.qa_status === 'approved')
      .map((s) => {
        const route = mockDb.routes.find((r) => r.id === s.route_id);
        return {
          id: s.id,
          route_id: s.route_id,
          route_name: route?.name ?? s.route_id,
          color: route?.color ?? '#3b82f6',
          direction: s.direction,
          coordinates: s.geom.coordinates as Coordinate[],
          qa_status: 'approved' as const,
        };
      });
  }

  if (origin[0] === destination[0] && origin[1] === destination[1]) {
    return [
      {
        type: 'direct',
        segments: [
          {
            type: 'walk',
            instruction: 'Ya estás en tu destino',
            distance: 0,
            duration: 0,
            walkFrom: origin,
            walkTo: destination,
            walkKind: 'to_board',
          },
        ],
        boardingPoint: origin,
        alightingPoint: destination,
        totalDistance: 0,
        totalDuration: 0,
        walkDistanceTotal: 0,
      },
    ];
  }

  if (shapes.length === 0) return [];

  const MIN_RIDE_M = 250;
  const directs: TripPlan[] = [];

  // Directos: mejor par Sube/Baja = mínima suma de caminatas
  for (const shape of shapes) {
    if (shape.coordinates.length < 2) continue;

    const pair = findShortestWalkBoardAlight(
      shape.coordinates,
      origin,
      destination,
      maxWalkDist
    );
    if (!pair) continue;
    if (pair.rideM < MIN_RIDE_M) continue;
    if (pair.walkTotal > maxDirectWalkTotal) continue;

    const board = asValidCoord(pair.board.point);
    const alight = asValidCoord(pair.alight.point);
    if (!board || !alight) continue;

    const walk1Dist = pair.board.walkM;
    const walk2Dist = pair.alight.walkM;
    const rideDistance = pair.rideM;
    const walkDuration = (walk1Dist + walk2Dist) / walkSpeed;
    const rideDuration = rideDistance / transitSpeed;
    const dirLabel = shape.direction === 'ida' ? 'Ida' : 'Vuelta';

    directs.push({
      type: 'direct',
      segments: [
        {
          type: 'walk',
          instruction: `Caminar ${formatWalk(walk1Dist)} hasta el punto virtual de subida`,
          distance: walk1Dist,
          duration: walk1Dist / walkSpeed,
          walkFrom: origin,
          walkTo: board,
          walkKind: 'to_board',
        },
        {
          type: 'ride',
          instruction: `Subir a ${shape.route_name} (${dirLabel}) · ~${Math.max(1, Math.round(rideDuration / 60))} min en ruta`,
          distance: rideDistance,
          duration: rideDuration,
          routeId: shape.route_id,
          routeName: shape.route_name,
          color: shape.color,
          direction: shape.direction,
          boardingPoint: board,
          alightingPoint: alight,
        },
        {
          type: 'walk',
          instruction: `Bajar y caminar ${formatWalk(walk2Dist)} al destino (punto virtual)`,
          distance: walk2Dist,
          duration: walk2Dist / walkSpeed,
          walkFrom: alight,
          walkTo: destination,
          walkKind: 'from_alight',
        },
      ],
      boardingPoint: board,
      alightingPoint: alight,
      totalDistance: walk1Dist + rideDistance + walk2Dist,
      totalDuration: walkDuration + rideDuration,
      walkDistanceTotal: walk1Dist + walk2Dist,
    });
  }

  const goodDirects = dedupePlans(
    directs.sort((a, b) => {
      // Priorizar menos caminata, luego menos tiempo total
      if (Math.abs(a.walkDistanceTotal - b.walkDistanceTotal) > 40) {
        return a.walkDistanceTotal - b.walkDistanceTotal;
      }
      return a.totalDuration - b.totalDuration;
    })
  ).slice(0, maxDirectPlans);

  // Solo omitir transbordos si el caller lo pide explícitamente y ya hay directos
  if (goodDirects.length > 0 && transferOnlyIfNecessary) {
    return goodDirects;
  }

  const transfers: TripPlan[] = [];
  if (allowTransfers) {
    // Precalcular puntos de acceso cortos a origen/destino por shape
    type ShapeAccess = {
      shape: PublishedShape;
      nearOrigin: AccessPoint[];
      nearDest: AccessPoint[];
    };

    const accessList: ShapeAccess[] = shapes.map((shape) => ({
      shape,
      nearOrigin: collectAccessPoints(shape.coordinates, origin, maxWalkDist),
      nearDest: collectAccessPoints(shape.coordinates, destination, maxWalkDist),
    }));

    const withOrigin = accessList
      .filter((a) => a.nearOrigin.length > 0)
      .sort(
        (a, b) =>
          Math.min(...a.nearOrigin.map((p) => p.walkM)) -
          Math.min(...b.nearOrigin.map((p) => p.walkM))
      )
      .slice(0, 20);

    const withDest = accessList
      .filter((a) => a.nearDest.length > 0)
      .sort(
        (a, b) =>
          Math.min(...a.nearDest.map((p) => p.walkM)) -
          Math.min(...b.nearDest.map((p) => p.walkM))
      )
      .slice(0, 20);

    for (const a of withOrigin) {
      for (const b of withDest) {
        if (a.shape.route_id === b.shape.route_id) continue;
        if (a.shape.id === b.shape.id) continue;

        // Mejor combinación: min walk_origen + walk_transbordo + walk_destino
        // con progresión en cada ruta
        const transferInfo = findTransferPoint(a.shape.coordinates, b.shape.coordinates);
        if (!transferInfo || transferInfo.transferWalkDist > 90) continue;

        const board1 = pickBestAccessBefore(
          a.nearOrigin,
          transferInfo.frac1,
          a.shape.coordinates
        );
        const alight2 = pickBestAccessAfter(
          b.nearDest,
          transferInfo.frac2,
          b.shape.coordinates
        );
        if (!board1 || !alight2) continue;

        const shape1Len = getShapeLength(a.shape.coordinates);
        const shape2Len = getShapeLength(b.shape.coordinates);
        const ride1Dist = (transferInfo.frac1 - board1.fraction) * shape1Len;
        const ride2Dist = (alight2.fraction - transferInfo.frac2) * shape2Len;
        if (ride1Dist < MIN_RIDE_M || ride2Dist < MIN_RIDE_M) continue;

        const walk1Dist = board1.walkM;
        const walk2Dist = alight2.walkM;
        const transferWalkDist = transferInfo.transferWalkDist;
        if (walk1Dist + walk2Dist + transferWalkDist > maxWalkDist * 2) continue;

        // Punto de subida a 2ª ruta = más cercano en shape2 al punto de bajada de shape1
        // (minimiza la punteada de transbordo)
        const xferOff = asValidCoord(transferInfo.point);
        const board2Pt = asValidCoord(
          b.shape.coordinates[transferInfo.idx2] ?? transferInfo.point
        );
        const board1Pt = asValidCoord(board1.point);
        const alight2Pt = asValidCoord(alight2.point);
        if (!board1Pt || !xferOff || !board2Pt || !alight2Pt) continue;

        // Re-medir walk de transbordo real entre puntos elegidos
        const realTransferWalk = getHaversineDistance(xferOff, board2Pt);
        if (realTransferWalk > 100) continue;

        const walkDuration =
          (walk1Dist + walk2Dist + realTransferWalk) / walkSpeed;
        const rideDuration = (ride1Dist + ride2Dist) / transitSpeed;

        transfers.push({
          type: 'transfer',
          segments: [
            {
              type: 'walk',
              instruction: `Caminar ${formatWalk(walk1Dist)} hasta el punto virtual de subida`,
              distance: walk1Dist,
              duration: walk1Dist / walkSpeed,
              walkFrom: origin,
              walkTo: board1Pt,
              walkKind: 'to_board',
            },
            {
              type: 'ride',
              instruction: `1ª · ${a.shape.route_name} (${a.shape.direction === 'ida' ? 'Ida' : 'Vuelta'}) · ~${Math.max(1, Math.round(ride1Dist / transitSpeed / 60))} min`,
              distance: ride1Dist,
              duration: ride1Dist / transitSpeed,
              routeId: a.shape.route_id,
              routeName: a.shape.route_name,
              color: a.shape.color,
              direction: a.shape.direction,
              boardingPoint: board1Pt,
              alightingPoint: xferOff,
            },
            {
              type: 'walk',
              instruction: `Transbordo · caminar ${formatWalk(realTransferWalk)} entre puntos virtuales`,
              distance: realTransferWalk,
              duration: realTransferWalk / walkSpeed,
              walkFrom: xferOff,
              walkTo: board2Pt,
              walkKind: 'transfer',
            },
            {
              type: 'ride',
              instruction: `2ª · ${b.shape.route_name} (${b.shape.direction === 'ida' ? 'Ida' : 'Vuelta'}) · ~${Math.max(1, Math.round(ride2Dist / transitSpeed / 60))} min`,
              distance: ride2Dist,
              duration: ride2Dist / transitSpeed,
              routeId: b.shape.route_id,
              routeName: b.shape.route_name,
              color: b.shape.color,
              direction: b.shape.direction,
              boardingPoint: board2Pt,
              alightingPoint: alight2Pt,
            },
            {
              type: 'walk',
              instruction: `Bajar y caminar ${formatWalk(walk2Dist)} al destino (punto virtual)`,
              distance: walk2Dist,
              duration: walk2Dist / walkSpeed,
              walkFrom: alight2Pt,
              walkTo: destination,
              walkKind: 'from_alight',
            },
          ],
          boardingPoint: board1Pt,
          alightingPoint: alight2Pt,
          totalDistance:
            walk1Dist + ride1Dist + realTransferWalk + ride2Dist + walk2Dist,
          totalDuration: walkDuration + rideDuration,
          walkDistanceTotal: walk1Dist + walk2Dist + realTransferWalk,
        });
      }
    }
  }

  const goodTransfers = dedupePlans(
    transfers.sort((a, b) => {
      if (Math.abs(a.walkDistanceTotal - b.walkDistanceTotal) > 40) {
        return a.walkDistanceTotal - b.walkDistanceTotal;
      }
      return a.totalDuration - b.totalDuration;
    })
  ).slice(0, maxTransferPlans);

  // Directos primero (más simples), luego transbordos útiles
  // El UI puede reordenar por tiempo/caminata/transbordos
  return [...goodDirects, ...goodTransfers].slice(0, maxDirectPlans + maxTransferPlans);
}

/**
 * Sube/Baja = trayectoria más corta desde origen/destino HASTA LA RUTA.
 *
 * Regla principal (lo que el usuario espera):
 *  - Sube aquí = punto de la polilínea más cercano al origen
 *  - Baja aquí = punto de la polilínea más cercano al destino
 * Si la ruta pasa a un lado de la persona, se sube ahí (no más adelante/atrás).
 *
 * Solo si esos dos puntos no respetan el sentido de la ruta (sube después de baja),
 * se ajusta el extremo que haga falta buscando el más cercano en el tramo válido.
 */
export function findShortestWalkBoardAlight(
  coords: Coordinate[],
  origin: Coordinate,
  destination: Coordinate,
  maxWalkM: number
): BoardAlightPair | null {
  if (coords.length < 2) return null;
  const totalLen = getShapeLength(coords);
  if (totalLen <= 0) return null;

  let boardNear: AccessPoint;
  let alightNear: AccessPoint;
  try {
    const b = projectPointOntoLineString(coords, origin);
    const a = projectPointOntoLineString(coords, destination);
    boardNear = {
      point: b.closest,
      walkM: b.distance,
      fraction: b.fraction,
      sampleIndex: -1,
    };
    alightNear = {
      point: a.closest,
      walkM: a.distance,
      fraction: a.fraction,
      sampleIndex: -1,
    };
  } catch {
    return null;
  }

  // Caso ideal: cada uno camina lo mínimo a la línea y el sentido es correcto
  if (
    boardNear.walkM <= maxWalkM &&
    alightNear.walkM <= maxWalkM &&
    alightNear.fraction > boardNear.fraction + 0.001
  ) {
    const rideM = (alightNear.fraction - boardNear.fraction) * totalLen;
    if (rideM >= 80) {
      return {
        board: boardNear,
        alight: alightNear,
        walkTotal: boardNear.walkM + alightNear.walkM,
        rideM,
      };
    }
  }

  // Sentido inválido o tramo demasiado corto: ajustar solo lo necesario
  // Opción 1: conservar subida más cercana al origen; bajar en el punto más cercano
  //           al destino DESPUÉS de esa subida
  // Opción 2: conservar bajada más cercana al destino; subir en el punto más cercano
  //           al origen ANTES de esa bajada
  const options: BoardAlightPair[] = [];

  if (boardNear.walkM <= maxWalkM) {
    const alightFixed = nearestAccessInFractionRange(
      coords,
      destination,
      boardNear.fraction + 0.002,
      1,
      maxWalkM
    );
    if (alightFixed) {
      const rideM = (alightFixed.fraction - boardNear.fraction) * totalLen;
      if (rideM >= 80) {
        options.push({
          board: boardNear,
          alight: alightFixed,
          walkTotal: boardNear.walkM + alightFixed.walkM,
          rideM,
        });
      }
    }
  }

  if (alightNear.walkM <= maxWalkM) {
    const boardFixed = nearestAccessInFractionRange(
      coords,
      origin,
      0,
      alightNear.fraction - 0.002,
      maxWalkM
    );
    if (boardFixed) {
      const rideM = (alightNear.fraction - boardFixed.fraction) * totalLen;
      if (rideM >= 80) {
        options.push({
          board: boardFixed,
          alight: alightNear,
          walkTotal: boardFixed.walkM + alightNear.walkM,
          rideM,
        });
      }
    }
  }

  // Último recurso: ambos extremos re-proyectados en rangos compatibles
  // (p.ej. origen y destino proyectan al mismo tramo)
  if (options.length === 0) {
    const boardAny = nearestAccessInFractionRange(coords, origin, 0, 0.98, maxWalkM);
    if (boardAny) {
      const alightAny = nearestAccessInFractionRange(
        coords,
        destination,
        boardAny.fraction + 0.002,
        1,
        maxWalkM
      );
      if (alightAny) {
        const rideM = (alightAny.fraction - boardAny.fraction) * totalLen;
        if (rideM >= 80) {
          options.push({
            board: boardAny,
            alight: alightAny,
            walkTotal: boardAny.walkM + alightAny.walkM,
            rideM,
          });
        }
      }
    }
  }

  if (options.length === 0) return null;

  // Entre opciones válidas: la de MENOS caminata total (sigue siendo la más corta a la línea)
  options.sort((a, b) => {
    if (Math.abs(a.walkTotal - b.walkTotal) > 1) return a.walkTotal - b.walkTotal;
    return a.rideM - b.rideM;
  });
  return options[0];
}

/**
 * Punto de la polilínea más cercano a `anchor` con fraction en [minFrac, maxFrac].
 * Es la trayectoria a pie más corta desde el usuario hasta un tramo usable de la ruta.
 */
function nearestAccessInFractionRange(
  coords: Coordinate[],
  anchor: Coordinate,
  minFrac: number,
  maxFrac: number,
  maxWalkM: number
): AccessPoint | null {
  if (coords.length < 2 || maxFrac <= minFrac) return null;

  const totalLen = getShapeLength(coords);
  if (totalLen <= 0) return null;

  let best: AccessPoint | null = null;
  let distAcc = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const segLen = getHaversineDistance(p1, p2);
    const fracStart = distAcc / totalLen;
    const fracEnd = (distAcc + segLen) / totalLen;

    // ¿El segmento intersecta el rango de fracciones?
    if (fracEnd < minFrac || fracStart > maxFrac) {
      distAcc += segLen;
      continue;
    }

    // Proyección en el segmento (coords planas locales; suficiente a escala de calle)
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((anchor[0] - p1[0]) * dx + (anchor[1] - p1[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    // Recortar t al subintervalo del segmento dentro de [minFrac, maxFrac]
    if (segLen > 0) {
      const tMin = Math.max(0, (minFrac - fracStart) / (fracEnd - fracStart || 1e-12));
      const tMax = Math.min(1, (maxFrac - fracStart) / (fracEnd - fracStart || 1e-12));
      if (tMin <= tMax) {
        t = Math.max(tMin, Math.min(tMax, t));
      } else {
        distAcc += segLen;
        continue;
      }
    }

    const proj: Coordinate = [p1[0] + t * dx, p1[1] + t * dy];
    const walkM = getHaversineDistance(anchor, proj);
    if (walkM > maxWalkM) {
      distAcc += segLen;
      continue;
    }

    const fraction = fracStart + t * (fracEnd - fracStart);
    if (!best || walkM < best.walkM) {
      best = {
        point: proj,
        walkM,
        fraction: Math.max(0, Math.min(1, fraction)),
        sampleIndex: i,
      };
    }

    distAcc += segLen;
  }

  return best;
}

function samplePolyline(
  coords: Coordinate[],
  maxSamples: number
): { point: Coordinate; fraction: number; index: number }[] {
  const total = getShapeLength(coords);
  if (total <= 0 || coords.length === 0) return [];

  const step = Math.max(1, Math.floor(coords.length / maxSamples));
  const out: { point: Coordinate; fraction: number; index: number }[] = [];
  let distAcc = 0;

  // fractions for each vertex
  const fracs: number[] = new Array(coords.length).fill(0);
  for (let i = 1; i < coords.length; i++) {
    distAcc += getHaversineDistance(coords[i - 1], coords[i]);
    fracs[i] = total > 0 ? distAcc / total : 0;
  }

  for (let i = 0; i < coords.length; i += step) {
    out.push({ point: coords[i], fraction: fracs[i], index: i });
  }
  // always include end
  const last = coords.length - 1;
  if (out[out.length - 1]?.index !== last) {
    out.push({ point: coords[last], fraction: 1, index: last });
  }
  return out;
}

function collectAccessPoints(
  coords: Coordinate[],
  anchor: Coordinate,
  maxWalkM: number
): AccessPoint[] {
  const out: AccessPoint[] = [];
  try {
    const proj = projectPointOntoLineString(coords, anchor);
    if (proj.distance <= maxWalkM) {
      out.push({
        point: proj.closest,
        walkM: proj.distance,
        fraction: proj.fraction,
        sampleIndex: -1,
      });
    }
  } catch {
    /* ignore */
  }

  // Algunos vértices cercanos por si la proyección cae en un bucle raro
  const samples = samplePolyline(coords, 40);
  for (const s of samples) {
    const walkM = getHaversineDistance(anchor, s.point);
    if (walkM <= maxWalkM) {
      out.push({
        point: s.point,
        walkM,
        fraction: s.fraction,
        sampleIndex: s.index,
      });
    }
  }

  out.sort((a, b) => a.walkM - b.walkM);
  const filtered: AccessPoint[] = [];
  for (const p of out) {
    if (filtered.some((f) => Math.abs(f.fraction - p.fraction) < 0.01)) continue;
    filtered.push(p);
    if (filtered.length >= 12) break;
  }
  return filtered;
}

/** Mejor acceso desde origen que quede ANTES del punto de transbordo */
function pickBestAccessBefore(
  candidates: AccessPoint[],
  transferFrac: number,
  _coords: Coordinate[]
): AccessPoint | null {
  const valid = candidates.filter((c) => c.fraction < transferFrac - 0.01);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.walkM <= b.walkM ? a : b));
}

/** Mejor acceso al destino que quede DESPUÉS del punto de transbordo */
function pickBestAccessAfter(
  candidates: AccessPoint[],
  transferFrac: number,
  _coords: Coordinate[]
): AccessPoint | null {
  const valid = candidates.filter((c) => c.fraction > transferFrac + 0.01);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.walkM <= b.walkM ? a : b));
}

/** Coord válida en Morelia (evita letreros en esquina del mapa). */
function asValidCoord(c: Coordinate | undefined | null): Coordinate | null {
  if (!c || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -101.5 || lng > -100.8 || lat < 19.45 || lat > 20.0) return null;
  return [lng, lat];
}

function formatWalk(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function dedupePlans(plans: TripPlan[]): TripPlan[] {
  const seen = new Set<string>();
  const out: TripPlan[] = [];
  for (const p of plans) {
    const key = p.segments
      .filter((s) => s.type === 'ride')
      .map((s) => `${s.routeId}:${s.direction}`)
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function getShapeLength(coords: Coordinate[]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += getHaversineDistance(coords[i], coords[i + 1]);
  }
  return length;
}

function findTransferPoint(
  line1: Coordinate[],
  line2: Coordinate[]
): {
  point: Coordinate;
  idx1: number;
  idx2: number;
  frac1: number;
  frac2: number;
  transferWalkDist: number;
} | null {
  const step1 = Math.max(1, Math.floor(line1.length / 80));
  const step2 = Math.max(1, Math.floor(line2.length / 80));
  let minDistance = Infinity;
  let bestIdx1 = -1;
  let bestIdx2 = -1;

  for (let i = 0; i < line1.length; i += step1) {
    for (let j = 0; j < line2.length; j += step2) {
      const dist = getHaversineDistance(line1[i], line2[j]);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx1 = i;
        bestIdx2 = j;
      }
    }
  }

  if (minDistance > 120 || bestIdx1 < 0) return null;

  const len1 = getShapeLength(line1);
  const len2 = getShapeLength(line2);
  let len1Before = 0;
  for (let i = 0; i < bestIdx1; i++) {
    len1Before += getHaversineDistance(line1[i], line1[i + 1]);
  }
  let len2Before = 0;
  for (let j = 0; j < bestIdx2; j++) {
    len2Before += getHaversineDistance(line2[j], line2[j + 1]);
  }

  return {
    point: line1[bestIdx1],
    idx1: bestIdx1,
    idx2: bestIdx2,
    frac1: len1 > 0 ? len1Before / len1 : 0,
    frac2: len2 > 0 ? len2Before / len2 : 0,
    transferWalkDist: minDistance,
  };
}
