import { mockDb, getHaversineDistance, projectPointOntoLineString } from '../supabase/client';

export type Coordinate = [number, number]; // [lng, lat]

export interface PlannerPreferences {
  maxWalkDistanceMeters?: number; // default 1000m
  allowTransfers?: boolean; // default true
  walkSpeedMeterPerSec?: number; // default 1.2 m/s
  transitSpeedMeterPerSec?: number; // default 8.0 m/s (approx 30 km/h)
}

export interface TravelSegment {
  type: 'walk' | 'ride';
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  // Ride specific
  routeId?: string;
  routeName?: string;
  color?: string;
  direction?: 'ida' | 'vuelta';
  boardingPoint?: Coordinate;
  alightingPoint?: Coordinate;
}

export interface TripPlan {
  type: 'direct' | 'transfer';
  segments: TravelSegment[];
  boardingPoint: Coordinate;
  alightingPoint: Coordinate;
  totalDistance: number;
  totalDuration: number;
}

/**
 * Performs origin-destination route planning.
 * Finds direct routes or routes with transfers.
 * Places virtual boarding and alighting points on the nearest route shape location.
 */
export async function planTrip(
  origin: Coordinate,
  destination: Coordinate,
  preferences: PlannerPreferences = {}
): Promise<TripPlan[]> {
  const maxWalkDist = preferences.maxWalkDistanceMeters ?? 1000;
  const allowTransfers = preferences.allowTransfers ?? true;
  const walkSpeed = preferences.walkSpeedMeterPerSec ?? 1.2;
  const transitSpeed = preferences.transitSpeedMeterPerSec ?? 8.0;

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
          },
        ],
        boardingPoint: origin,
        alightingPoint: destination,
        totalDistance: 0,
        totalDuration: 0,
      },
    ];
  }

  const activeShapes = mockDb.route_shapes.filter((s) => s.qa_status === 'approved');
  const plans: TripPlan[] = [];

  // 1. Identify candidate boarding routes (routes near origin)
  const boardingCandidates = activeShapes.map((shape) => {
    const proj = projectPointOntoLineString(shape.geom.coordinates, origin);
    return {
      shape,
      proj,
      walkDistance: proj.distance,
    };
  }).filter((c) => c.walkDistance <= maxWalkDist);

  // 2. Identify candidate alighting routes (routes near destination)
  const alightingCandidates = activeShapes.map((shape) => {
    const proj = projectPointOntoLineString(shape.geom.coordinates, destination);
    return {
      shape,
      proj,
      walkDistance: proj.distance,
    };
  }).filter((c) => c.walkDistance <= maxWalkDist);

  // 3. Search for Direct Trips
  for (const bCand of boardingCandidates) {
    const aCand = alightingCandidates.find((a) => a.shape.id === bCand.shape.id);
    if (aCand) {
      // Must move forward along the route (fraction of boarding < fraction of alighting)
      if (bCand.proj.fraction < aCand.proj.fraction) {
        const route = mockDb.routes.find((r) => r.id === bCand.shape.route_id);
        if (!route) continue;

        // Calculate ride distance along shape coordinates
        const rideDistance = Math.abs(aCand.proj.fraction - bCand.proj.fraction) * getShapeLength(bCand.shape.geom.coordinates);
        
        const walk1Dist = bCand.walkDistance;
        const walk2Dist = aCand.walkDistance;

        const walkDuration = (walk1Dist + walk2Dist) / walkSpeed;
        const rideDuration = rideDistance / transitSpeed;

        const segments: TravelSegment[] = [
          {
            type: 'walk',
            instruction: `Caminar ${Math.round(walk1Dist)}m hacia punto de abordaje virtual sugerido`,
            distance: walk1Dist,
            duration: walk1Dist / walkSpeed,
          },
          {
            type: 'ride',
            instruction: `Abordar ${route.name} (${bCand.shape.direction === 'ida' ? 'Ida' : 'Vuelta'}) en punto virtual sugerido`,
            distance: rideDistance,
            duration: rideDuration,
            routeId: route.id,
            routeName: route.name,
            color: route.color,
            direction: bCand.shape.direction,
            boardingPoint: bCand.proj.closest,
            alightingPoint: aCand.proj.closest,
          },
          {
            type: 'walk',
            instruction: `Caminar ${Math.round(walk2Dist)}m desde el punto de descenso virtual sugerido al destino`,
            distance: walk2Dist,
            duration: walk2Dist / walkSpeed,
          },
        ];

        plans.push({
          type: 'direct',
          segments,
          boardingPoint: bCand.proj.closest,
          alightingPoint: aCand.proj.closest,
          totalDistance: walk1Dist + rideDistance + walk2Dist,
          totalDuration: walkDuration + rideDuration,
        });
      }
    }
  }

  // 4. Search for Transfer Trips (1-transfer)
  if (allowTransfers) {
    for (const bCand of boardingCandidates) {
      for (const aCand of alightingCandidates) {
        // Skip if same shape (handled by direct or invalid if fraction check failed)
        if (bCand.shape.id === aCand.shape.id) continue;
        
        // Find potential transfer point
        const transferInfo = findTransferPoint(bCand.shape.geom.coordinates, aCand.shape.geom.coordinates);
        if (transferInfo) {
          const { point, frac1, frac2 } = transferInfo;

          // Verify progression:
          // Boarding on Route 1 must be before the transfer point
          // Transfer point on Route 2 must be before alighting
          if (bCand.proj.fraction < frac1 && frac2 < aCand.proj.fraction) {
            const route1 = mockDb.routes.find((r) => r.id === bCand.shape.route_id);
            const route2 = mockDb.routes.find((r) => r.id === aCand.shape.route_id);
            if (!route1 || !route2) continue;

            const shape1Len = getShapeLength(bCand.shape.geom.coordinates);
            const shape2Len = getShapeLength(aCand.shape.geom.coordinates);

            const ride1Dist = (frac1 - bCand.proj.fraction) * shape1Len;
            const ride2Dist = (aCand.proj.fraction - frac2) * shape2Len;

            // In our simple transfer, transfer walk distance is the distance between intersection approximations
            // If they intersect perfectly, this is 0
            const transferWalkDist = getHaversineDistance(bCand.shape.geom.coordinates[transferInfo.idx1], aCand.shape.geom.coordinates[transferInfo.idx2]);
            const walk1Dist = bCand.walkDistance;
            const walk2Dist = aCand.walkDistance;

            const walkDuration = (walk1Dist + walk2Dist + transferWalkDist) / walkSpeed;
            const rideDuration = (ride1Dist + ride2Dist) / transitSpeed;

            const segments: TravelSegment[] = [
              {
                type: 'walk',
                instruction: `Caminar ${Math.round(walk1Dist)}m hacia punto de abordaje virtual sugerido`,
                distance: walk1Dist,
                duration: walk1Dist / walkSpeed,
              },
              {
                type: 'ride',
                instruction: `Abordar ${route1.name} (${bCand.shape.direction === 'ida' ? 'Ida' : 'Vuelta'}) en punto virtual sugerido`,
                distance: ride1Dist,
                duration: ride1Dist / transitSpeed,
                routeId: route1.id,
                routeName: route1.name,
                color: route1.color,
                direction: bCand.shape.direction,
                boardingPoint: bCand.proj.closest,
                alightingPoint: point,
              },
              {
                type: 'walk',
                instruction: `Transbordar en punto virtual de conexión (caminar ${Math.round(transferWalkDist)}m)`,
                distance: transferWalkDist,
                duration: transferWalkDist / walkSpeed,
              },
              {
                type: 'ride',
                instruction: `Tomar ${route2.name} (${aCand.shape.direction === 'ida' ? 'Ida' : 'Vuelta'}) en punto virtual sugerido`,
                distance: ride2Dist,
                duration: ride2Dist / transitSpeed,
                routeId: route2.id,
                routeName: route2.name,
                color: route2.color,
                direction: aCand.shape.direction,
                boardingPoint: point,
                alightingPoint: aCand.proj.closest,
              },
              {
                type: 'walk',
                instruction: `Caminar ${Math.round(walk2Dist)}m desde punto de descenso virtual sugerido al destino`,
                distance: walk2Dist,
                duration: walk2Dist / walkSpeed,
              },
            ];

            plans.push({
              type: 'transfer',
              segments,
              boardingPoint: bCand.proj.closest,
              alightingPoint: aCand.proj.closest,
              totalDistance: walk1Dist + ride1Dist + transferWalkDist + ride2Dist + walk2Dist,
              totalDuration: walkDuration + rideDuration,
            });
          }
        }
      }
    }
  }

  // Sort plans: direct first, then by total duration
  return plans.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'direct' ? -1 : 1;
    }
    return a.totalDuration - b.totalDuration;
  });
}

// Compute total shape length in meters
function getShapeLength(coords: Coordinate[]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += getHaversineDistance(coords[i], coords[i + 1]);
  }
  return length;
}

// Helper to find transfer point between two LineStrings
function findTransferPoint(
  line1: Coordinate[],
  line2: Coordinate[]
): { point: Coordinate; idx1: number; idx2: number; frac1: number; frac2: number } | null {
  // Find pair of vertices that are closest to each other
  let minDistance = Infinity;
  let bestIdx1 = -1;
  let bestIdx2 = -1;

  for (let i = 0; i < line1.length; i++) {
    for (let j = 0; j < line2.length; j++) {
      const dist = getHaversineDistance(line1[i], line2[j]);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx1 = i;
        bestIdx2 = j;
      }
    }
  }

  // If the closest points are within 150 meters, we consider it a transfer point
  if (minDistance <= 150 && bestIdx1 !== -1 && bestIdx2 !== -1) {
    const point = line1[bestIdx1];
    
    // Calculate fraction along line 1
    let len1Before = 0;
    for (let i = 0; i < bestIdx1; i++) {
      len1Before += getHaversineDistance(line1[i], line1[i + 1]);
    }
    const frac1 = getShapeLength(line1) > 0 ? len1Before / getShapeLength(line1) : 0;

    // Calculate fraction along line 2
    let len2Before = 0;
    for (let j = 0; j < bestIdx2; j++) {
      len2Before += getHaversineDistance(line2[j], line2[j + 1]);
    }
    const frac2 = getShapeLength(line2) > 0 ? len2Before / getShapeLength(line2) : 0;

    return {
      point,
      idx1: bestIdx1,
      idx2: bestIdx2,
      frac1,
      frac2,
    };
  }

  return null;
}
