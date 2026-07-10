import { createClient as createRealClient, SupabaseClient } from '@supabase/supabase-js';

// Define DB Types
export interface Route {
  id: string;
  name: string;
  description?: string;
  color: string;
  casing_color: string;
  transport_type: string;
  status: 'approved' | 'needs_review' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface RouteShape {
  id: string;
  route_id: string;
  direction: 'ida' | 'vuelta';
  geom: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat]
  };
  matched_to_osm: boolean;
  qa_status: 'approved' | 'needs_review' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface RouteTransferPoint {
  id: string;
  route_id_1: string;
  route_id_2: string;
  geom: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Place {
  id: string;
  name: string;
  description?: string;
  geom: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface FavoriteRoute {
  id: string;
  user_id: string;
  route_id: string;
  created_at: string;
}

export interface FavoritePlace {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
}

/** Ubicación favorita libre (nombre + coords) */
export interface FavoriteLocationRow {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  lng: number;
  lat: number;
  created_at: string;
}

export interface RecentSearch {
  id: string;
  user_id: string;
  query: string;
  search_type: string;
  filters?: unknown;
  created_at: string;
}

export interface DatasetVersion {
  id: string;
  version_name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface GisQualityReport {
  id: string;
  route_shape_id: string;
  confidence_score: number;
  validation_details?: unknown;
  created_at: string;
}

// Seed data
const seedRoutes: Route[] = [
  {
    id: 'ruta-roja-1',
    name: 'Ruta Roja 1',
    description: 'Ruta Roja de Morelia - Centro a Sur',
    color: '#ff0000',
    casing_color: '#222222',
    transport_type: 'bus',
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ruta-gris-1',
    name: 'Ruta Gris 1',
    description: 'Ruta Gris de Morelia - Circuito Metropolitano',
    color: '#808080',
    casing_color: '#222222',
    transport_type: 'bus',
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ruta-azul-1',
    name: 'Ruta Azul 1',
    description: 'Ruta Azul de Morelia - Centro a Norte',
    color: '#0000ff',
    casing_color: '#222222',
    transport_type: 'bus',
    status: 'needs_review',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'test-route-1',
    name: 'Ruta de Prueba 1',
    description: 'Ruta de Prueba 1 para verificación de Ida y Vuelta',
    color: '#FFC800',
    casing_color: '#222222',
    transport_type: 'combi',
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const seedRouteShapes: RouteShape[] = [
  {
    id: 'shape-roja-ida',
    route_id: 'ruta-roja-1',
    direction: 'ida',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.194, 19.702], // Cathedral
        [-101.195, 19.692],
        [-101.196, 19.682], // Zoo
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shape-roja-vuelta',
    route_id: 'ruta-roja-1',
    direction: 'vuelta',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.196, 19.682], // Zoo
        [-101.195, 19.692],
        [-101.194, 19.702], // Cathedral
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shape-gris-ida',
    route_id: 'ruta-gris-1',
    direction: 'ida',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.210, 19.702],
        [-101.194, 19.702], // Cathedral (Intersection)
        [-101.180, 19.702],
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shape-gris-vuelta',
    route_id: 'ruta-gris-1',
    direction: 'vuelta',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.180, 19.702],
        [-101.194, 19.702],
        [-101.210, 19.702],
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shape-test-route-1-ida',
    route_id: 'test-route-1',
    direction: 'ida',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.210, 19.7020],
        [-101.194, 19.7020],
        [-101.180, 19.7020]
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shape-test-route-1-vuelta',
    route_id: 'test-route-1',
    direction: 'vuelta',
    geom: {
      type: 'LineString',
      coordinates: [
        [-101.180, 19.7015],
        [-101.194, 19.7015],
        [-101.210, 19.7015]
      ]
    },
    matched_to_osm: true,
    qa_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const seedPlaces: Place[] = [
  {
    id: 'place-cathedral',
    name: 'Catedral de Morelia',
    description: 'Catedral en el centro histórico',
    geom: { type: 'Point', coordinates: [-101.194, 19.702] },
    category: 'tourist',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'place-zoo',
    name: 'Zoológico de Morelia',
    description: 'Zoológico Benito Juárez',
    geom: { type: 'Point', coordinates: [-101.196, 19.682] },
    category: 'park',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

class MockDatabase {
  profiles: Profile[] = [];
  routes: Route[] = [...seedRoutes];
  route_shapes: RouteShape[] = [...seedRouteShapes];
  route_transfer_points: RouteTransferPoint[] = [];
  places: Place[] = [...seedPlaces];
  favorite_places: FavoritePlace[] = [];
  favorite_routes: FavoriteRoute[] = [];
  favorite_locations: FavoriteLocationRow[] = [];
  recent_searches: RecentSearch[] = [];
  dataset_versions: DatasetVersion[] = [];
  gis_quality_reports: GisQualityReport[] = [];

  // Active session details
  currentUser: { id: string; email: string } | null = null;
  authToken: string | null = null;

  reset() {
    this.profiles = [];
    this.routes = [...seedRoutes];
    this.route_shapes = [...seedRouteShapes];
    this.route_transfer_points = [];
    this.places = [...seedPlaces];
    this.favorite_places = [];
    this.favorite_routes = [];
    this.favorite_locations = [];
    this.recent_searches = [];
    this.dataset_versions = [];
    this.gis_quality_reports = [];
    this.currentUser = null;
    this.authToken = null;
  }
}

// Global In-Memory Database Instance
export const mockDb = new MockDatabase();

// Calculate distance in meters using simple spherical law of cosines/haversine
export function getHaversineDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Helper to project a point onto a line segment
export function projectPointOntoLineString(
  line: [number, number][],
  point: [number, number]
): { closest: [number, number]; distance: number; fraction: number } {
  if (line.length === 0) {
    throw new Error("LineString must have at least one point");
  }
  if (line.length === 1) {
    return {
      closest: line[0],
      distance: getHaversineDistance(point, line[0]),
      fraction: 0,
    };
  }

  let minDistance = Infinity;
  let closestPoint: [number, number] = line[0];
  let totalLength = 0;
  const lengths: number[] = [];

  for (let i = 0; i < line.length - 1; i++) {
    const d = getHaversineDistance(line[i], line[i + 1]);
    lengths.push(d);
    totalLength += d;
  }

  let fraction = 0;
  let currentLength = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const p1 = line[i];
    const p2 = line[i + 1];
    const segmentLength = lengths[i];

    // Vector projection
    const x = point[0];
    const y = point[1];
    const x1 = p1[0];
    const y1 = p1[1];
    const x2 = p2[0];
    const y2 = p2[1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const proj: [number, number] = [projX, projY];

    const dist = getHaversineDistance(point, proj);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = proj;
      
      const segmentDist = segmentLength * t;
      fraction = totalLength > 0 ? (currentLength + segmentDist) / totalLength : 0;
    }
    currentLength += segmentLength;
  }

  return {
    closest: closestPoint,
    distance: minDistance,
    fraction,
  };
}

class QueryBuilder {
  private tableName: keyof MockDatabase;
  private filters: ((item: Record<string, unknown>) => boolean)[] = [];
  private orderColumn: string | null = null;
  private orderAscending: boolean = true;
  private limitValue: number | null = null;
  private isSingle: boolean = false;

  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private actionData: unknown = null;

  constructor(tableName: keyof MockDatabase) {
    this.tableName = tableName;
  }

  private checkRLS(action: 'read' | 'write', item?: Record<string, unknown>): void {
    const requiresAuth = [
      'favorite_places',
      'favorite_routes',
      'favorite_locations',
      'recent_searches',
    ].includes(this.tableName);

    // General write checks
    if (action === 'write') {
      if (!mockDb.currentUser || !mockDb.authToken) {
        throw new Error('RLS Violation: Write actions require a valid auth token.');
      }
    }

    // Owner checks
    if (requiresAuth) {
      if (!mockDb.currentUser) {
        throw new Error('RLS Violation: Auth required for owner-restricted resource.');
      }
      if (item && item.user_id !== mockDb.currentUser.id) {
        throw new Error('RLS Violation: User does not own this resource.');
      }
    }
  }

  select(_columns: string = '*') {
    this.action = 'select';
    void _columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((item) => (item[column] as number) > (value as number));
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((item) => (item[column] as number) < (value as number));
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.orderColumn = column;
    this.orderAscending = ascending;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(data: unknown) {
    this.action = 'insert';
    this.actionData = data;
    return this;
  }

  update(data: unknown) {
    this.action = 'update';
    this.actionData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(data: unknown) {
    this.action = 'upsert';
    this.actionData = data;
    return this;
  }

  // Execute action and return a Promise-like object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let promise: Promise<{ data: any; error: Error | null }>;

    try {
      if (this.action === 'select') {
        this.checkRLS('read');
        const table = mockDb[this.tableName] as unknown as Record<string, unknown>[];
        let results = table.filter((item) => {
          if (['favorite_places', 'favorite_routes', 'recent_searches'].includes(this.tableName)) {
            if (!mockDb.currentUser || item.user_id !== mockDb.currentUser.id) {
              return false;
            }
          }
          return this.filters.every((f) => f(item));
        });

        if (this.orderColumn) {
          const col = this.orderColumn;
          const asc = this.orderAscending;
          results.sort((a, b) => {
            const valA = a[col];
            const valB = b[col];
            if (valA === valB) return 0;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            if (typeof valA === 'number' && typeof valB === 'number') {
              return asc ? valA - valB : valB - valA;
            }
            const strA = String(valA);
            const strB = String(valB);
            if (strA < strB) return asc ? -1 : 1;
            if (strA > strB) return asc ? 1 : -1;
            return 0;
          });
        }

        if (this.limitValue !== null) {
          results = results.slice(0, this.limitValue);
        }

        const payload = this.isSingle ? (results[0] || null) : results;
        promise = Promise.resolve({ data: payload, error: null });
      } else if (this.action === 'insert') {
        this.checkRLS('write');
        const items = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
        const table = mockDb[this.tableName] as unknown as Record<string, unknown>[];

        const inserted: Record<string, unknown>[] = [];
        let dupError: Error | null = null;

        for (const item of items) {
          const row = { ...(item as Record<string, unknown>) };
          if (!row.id) {
            row.id = Math.random().toString(36).substring(2, 9);
          }

          // Enforce unique constraints
          if (this.tableName === 'routes') {
            if (table.some((r) => r.id === row.id)) {
              dupError = new Error('Unique constraint violation: Route ID already exists');
              break;
            }
          } else if (this.tableName === 'favorite_routes') {
            if (table.some((r) => r.user_id === row.user_id && r.route_id === row.route_id)) {
              dupError = new Error('Unique constraint violation: user_id and route_id combination already exists');
              break;
            }
          } else if (this.tableName === 'favorite_places') {
            if (table.some((r) => r.user_id === row.user_id && r.place_id === row.place_id)) {
              dupError = new Error('Unique constraint violation: user_id and place_id combination already exists');
              break;
            }
          }

          this.checkRLS('write', row);
          table.push(row);
          inserted.push(row);
        }

        if (dupError) {
          promise = Promise.resolve({ data: null, error: dupError });
        } else {
          promise = Promise.resolve({ data: this.isSingle ? inserted[0] : inserted, error: null });
        }
      } else if (this.action === 'upsert') {
        this.checkRLS('write');
        const items = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
        const table = mockDb[this.tableName] as unknown as Record<string, unknown>[];

        const upserted: Record<string, unknown>[] = [];

        for (const item of items) {
          const row = { ...(item as Record<string, unknown>) };
          if (!row.id && this.tableName !== 'route_shapes') {
            row.id = Math.random().toString(36).substring(2, 9);
          }

          this.checkRLS('write', row);

          let idx = -1;
          if (this.tableName === 'route_shapes') {
            idx = table.findIndex(
              (r) => r.route_id === row.route_id && r.direction === row.direction
            );
          } else if (row.id) {
            idx = table.findIndex((r) => r.id === row.id);
          }

          if (idx >= 0) {
            table[idx] = { ...table[idx], ...row };
            upserted.push(table[idx]);
          } else {
            table.push(row);
            upserted.push(row);
          }
        }
        promise = Promise.resolve({ data: this.isSingle ? upserted[0] : upserted, error: null });
      } else if (this.action === 'update') {
        this.checkRLS('write');
        const table = mockDb[this.tableName] as unknown as Record<string, unknown>[];
        const updatedItems: Record<string, unknown>[] = [];

        for (let i = 0; i < table.length; i++) {
          const item = table[i];
          const match = this.filters.every((f) => f(item));
          if (match) {
            this.checkRLS('write', item);
            const updatedItem = { ...item, ...(this.actionData as Record<string, unknown>) };
            table[i] = updatedItem;
            updatedItems.push(updatedItem);
          }
        }
        promise = Promise.resolve({ data: this.isSingle ? updatedItems[0] : updatedItems, error: null });
      } else {
        // delete
        this.checkRLS('write');
        const table = mockDb[this.tableName] as unknown as Record<string, unknown>[];
        const remaining: Record<string, unknown>[] = [];
        const deleted: Record<string, unknown>[] = [];

        for (const item of table) {
          const match = this.filters.every((f) => f(item));
          if (match) {
            this.checkRLS('write', item);
            deleted.push(item);
          } else {
            remaining.push(item);
          }
        }
        (mockDb as unknown as Record<string, unknown[]>)[this.tableName] = remaining;
        promise = Promise.resolve({ data: deleted, error: null });
      }
    } catch (err: unknown) {
      promise = Promise.resolve({
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }

    return promise.then(onfulfilled, onrejected);
  }
}

let realClientInstance: SupabaseClient | null = null;

function getRealClient(): SupabaseClient {
  if (!realClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
    }
    realClientInstance = createRealClient(url, key);
  }
  return realClientInstance;
}

export const mockSupabaseClient = {
  from(tableName: string): QueryBuilder {
    const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
    if (useRealSupabase) {
      return getRealClient().from(tableName) as unknown as QueryBuilder;
    }
    if (!(tableName in mockDb)) {
      throw new Error(`Table ${tableName} does not exist in mock DB schema.`);
    }
    return new QueryBuilder(tableName as keyof MockDatabase);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpc(functionName: string, params: any) {
    const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
    if (useRealSupabase) {
      return getRealClient().rpc(functionName, params);
    }
    if (functionName === 'find_routes_near_point' || functionName === 'get_routes_near_point') {
      const { point_lon, point_lat, distance_meters, lng, lat, radius_meters } = params;
      const targetLon = point_lon !== undefined ? point_lon : lng;
      const targetLat = point_lat !== undefined ? point_lat : lat;
      const targetRadius = distance_meters !== undefined ? distance_meters : radius_meters;

      if (targetLon === undefined || targetLat === undefined || targetRadius === undefined) {
        return { data: null, error: new Error('Missing arguments for spatial rpc') };
      }

      const results = [];
      for (const shape of mockDb.route_shapes) {
        if (shape.qa_status !== 'approved') continue;
        const route = mockDb.routes.find((r) => r.id === shape.route_id);
        if (!route) continue;

        // Project point onto shape coordinates to find the min distance
        const projection = projectPointOntoLineString(shape.geom.coordinates, [targetLon, targetLat]);
        if (projection.distance <= targetRadius) {
          results.push({
            route_id: route.id,
            route_name: route.name,
            direction: shape.direction,
            color: route.color,
            casing_color: route.casing_color,
            transport_type: route.transport_type,
            distance: projection.distance,
          });
        }
      }

      results.sort((a, b) => a.distance - b.distance);
      return { data: results, error: null };
    }

    if (functionName === 'project_point_onto_route') {
      const { shape_id, point_lon, point_lat } = params;
      const shape = mockDb.route_shapes.find((s) => s.id === shape_id);
      if (!shape) {
        return { data: null, error: new Error(`Route shape not found: ${shape_id}`) };
      }

      const projection = projectPointOntoLineString(shape.geom.coordinates, [point_lon, point_lat]);
      return {
        data: [{
          closest_lon: projection.closest[0],
          closest_lat: projection.closest[1],
          distance_meters: projection.distance,
          fraction: projection.fraction,
        }],
        error: null,
      };
    }

    return { data: null, error: new Error(`Mock RPC function ${functionName} not implemented`) };
  },

  auth: {
    listeners: new Set<(event: string, session: unknown) => void>(),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signUp(params: any) {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.signUp(params);
      }
      const { email, options } = params;
      const username = options?.data?.username || email;
      const full_name = options?.data?.full_name || '';

      const existingUser = mockDb.profiles.find((p) => p.username === username);
      if (existingUser) {
        return { data: null, error: new Error('User already exists') };
      }

      const userId = 'user-' + Math.random().toString(36).substring(2, 9);
      const newProfile: Profile = {
        id: userId,
        username,
        full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockDb.profiles.push(newProfile);
      mockDb.currentUser = { id: userId, email };
      mockDb.authToken = 'mock-jwt-token-' + userId;

      const session = {
        access_token: mockDb.authToken,
        user: { id: userId, email, user_metadata: options?.data || {} },
      };

      this.listeners.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { user: session.user, session }, error: null as Error | null };
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signInWithOAuth(params: { provider: string; options?: { redirectTo?: string } }) {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.signInWithOAuth(params as any);
      }
      const userId = 'google-user-' + Math.random().toString(36).substring(2, 9);
      const email = 'google.user@gmail.com';
      let profile = mockDb.profiles.find((p) => p.username === email);
      if (!profile) {
        profile = {
          id: userId,
          username: email,
          full_name: 'Google User',
          avatar_url: 'https://lh3.googleusercontent.com/a/default',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockDb.profiles.push(profile);
      }
      mockDb.currentUser = { id: profile.id, email };
      mockDb.authToken = 'mock-google-jwt-token-' + profile.id;
      const session = {
        access_token: mockDb.authToken,
        user: { id: profile.id, email, user_metadata: { full_name: profile.full_name, avatar_url: profile.avatar_url } },
      };
      this.listeners.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { provider: params.provider, url: params.options?.redirectTo || 'http://localhost:3000' }, error: null };
    },

    async signInWithPassword(params: any) {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.signInWithPassword(params);
      }
      const { email } = params;
      // In this mock, we assume user profile exists under that username/email
      let profile = mockDb.profiles.find((p) => p.username === email);
      if (!profile) {
        // Auto create or search
        const userId = 'user-' + Math.random().toString(36).substring(2, 9);
        profile = {
          id: userId,
          username: email,
          full_name: email.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockDb.profiles.push(profile);
      }

      mockDb.currentUser = { id: profile.id, email };
      mockDb.authToken = 'mock-jwt-token-' + profile.id;

      const session = {
        access_token: mockDb.authToken,
        user: { id: profile.id, email },
      };

      this.listeners.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { user: session.user, session }, error: null as Error | null };
    },

    /**
     * Magic link / OTP sin contraseña.
     * En Supabase real: envía correo con enlace.
     * En mock: simula envío y crea sesión para desarrollo local.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signInWithOtp(params: {
      email: string;
      options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
    }) {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.signInWithOtp(params as any);
      }

      const email = (params.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return {
          data: { user: null, session: null },
          error: new Error('Correo inválido'),
        };
      }

      // Mock: “envía” enlace y deja sesión lista (solo desarrollo)
      let profile = mockDb.profiles.find((p) => p.username === email);
      if (!profile) {
        const userId = 'otp-user-' + Math.random().toString(36).substring(2, 9);
        profile = {
          id: userId,
          username: email,
          full_name: email.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockDb.profiles.push(profile);
      }
      mockDb.currentUser = { id: profile.id, email };
      mockDb.authToken = 'mock-otp-jwt-' + profile.id;
      const session = {
        access_token: mockDb.authToken,
        user: { id: profile.id, email },
      };
      this.listeners.forEach((cb) => cb('SIGNED_IN', session));
      return {
        data: { user: session.user, session },
        error: null as Error | null,
      };
    },

    async signOut() {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.signOut();
      }
      mockDb.currentUser = null;
      mockDb.authToken = null;
      this.listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null as Error | null };
    },

    async getUser() {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.getUser();
      }
      if (!mockDb.currentUser) return { data: { user: null }, error: null as Error | null };
      return {
        data: {
          user: {
            id: mockDb.currentUser.id,
            email: mockDb.currentUser.email,
          },
        },
        error: null as Error | null,
      };
    },

    async getSession() {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.getSession();
      }
      if (!mockDb.currentUser || !mockDb.authToken) return { data: { session: null }, error: null as Error | null };
      return {
        data: {
          session: {
            access_token: mockDb.authToken,
            user: {
              id: mockDb.currentUser.id,
              email: mockDb.currentUser.email,
            },
          },
        },
        error: null as Error | null,
      };
    },

    onAuthStateChange(callback: (event: string, session: unknown) => void) {
      const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
      if (useRealSupabase) {
        return getRealClient().auth.onAuthStateChange(callback);
      }
      this.listeners.add(callback);
      // Run initial callback
      const session = mockDb.currentUser ? {
        access_token: mockDb.authToken,
        user: { id: mockDb.currentUser.id, email: mockDb.currentUser.email },
      } : null;
      callback(mockDb.currentUser ? 'SIGNED_IN' : 'SIGNED_OUT', session);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.listeners.delete(callback);
            },
          },
        },
      };
    },
  },
};

// Standard export of client creator
export function createClient(supabaseUrl: string, supabaseKey: string) {
  const useRealSupabase = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true';
  if (useRealSupabase) {
    return createRealClient(supabaseUrl, supabaseKey);
  }
  return mockSupabaseClient;
}
