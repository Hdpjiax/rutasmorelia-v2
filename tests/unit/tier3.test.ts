import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, mockSupabaseClient } from '@/lib/supabase/client';
import { validateRouteShape } from '@/lib/gis/validation';
import { planTrip } from '@/lib/routing/planner';
import { fuzzySearchRoutes } from '@/lib/search/fuzzy';

describe('Tier 3: Cross-Feature Combinations (5 Tests)', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it('1. should search route, toggle favorite, and prepare map rendering metadata (Search + Favorites + Map)', async () => {
    // 1. Search for 'Roja'
    const searchResults = fuzzySearchRoutes(mockDb.routes, 'Roja');
    expect(searchResults).toHaveLength(1);
    const targetRoute = searchResults[0];

    // 2. Favorite the found route
    await mockSupabaseClient.auth.signUp({ email: 'comb1@test.com', password: 'pw' });
    const { data: user } = await mockSupabaseClient.auth.getUser();
    await mockSupabaseClient.from('favorite_routes').insert({
      user_id: user.user!.id,
      route_id: targetRoute.id,
    });

    const { data: favs } = await mockSupabaseClient.from('favorite_routes').select('*');
    expect(favs[0].route_id).toBe(targetRoute.id);

    // 3. Extract geometry for map rendering
    const { data: shapes } = await mockSupabaseClient.from('route_shapes').select('*').eq('route_id', targetRoute.id);
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0].geom.type).toBe('LineString');
    expect(shapes[0].geom.coordinates[0]).toEqual([-101.194, 19.702]);
  });

  it('2. should persist favorites across login/logout sessions (Auth + Favorites)', async () => {
    const email = 'session@test.com';
    const pw = 'password123';

    const { data: authData } = await mockSupabaseClient.auth.signUp({ email, password: pw });
    expect(authData).not.toBeNull();
    const userId = authData!.user!.id;

    // 2. Add route to favorites
    await mockSupabaseClient.from('favorite_routes').insert({
      user_id: userId,
      route_id: 'ruta-roja-1',
    });

    // 3. Sign out and verify favorites are inaccessible/empty (RLS check on SELECT)
    await mockSupabaseClient.auth.signOut();
    const { error: rlsError } = await mockSupabaseClient
      .from('favorite_routes')
      .select('*')
      .eq('user_id', userId);
    expect(rlsError).not.toBeNull(); // RLS read violation since not logged in

    // 4. Log back in and verify favorite is retrieved
    await mockSupabaseClient.auth.signInWithPassword({ email, password: pw });
    const { data: activeFavs, error: okError } = await mockSupabaseClient
      .from('favorite_routes')
      .select('*')
      .eq('user_id', userId);
    expect(okError).toBeNull();
    expect(activeFavs).toHaveLength(1);
    expect(activeFavs[0].route_id).toBe('ruta-roja-1');
  });

  it('3. should verify travel plan boarding points are within Morelia map zoom bounds (Planner + Map)', async () => {
    const origin: [number, number] = [-101.194, 19.702];
    const dest: [number, number] = [-101.196, 19.682];

    const plans = await planTrip(origin, dest);
    expect(plans.length).toBeGreaterThan(0);

    const boardingPt = plans[0].boardingPoint;
    
    // Morelia map bounds defined in specification: 19.5 to 20.0 Lat, -101.4 to -101.0 Lng
    expect(boardingPt[0]).toBeGreaterThanOrEqual(-101.4);
    expect(boardingPt[0]).toBeLessThanOrEqual(-101.0);
    expect(boardingPt[1]).toBeGreaterThanOrEqual(19.5);
    expect(boardingPt[1]).toBeLessThanOrEqual(20.0);
  });

  it('4. should load route shapes from DB and validate integrity with GIS Pipeline (DB + GIS)', async () => {
    const { data: shapes } = await mockSupabaseClient.from('route_shapes').select('*');
    expect(shapes.length).toBeGreaterThan(0);

    for (const shape of shapes) {
      const validation = validateRouteShape(shape.geom.coordinates);
      expect(validation.isValid).toBe(true);
      expect(validation.boundsValid).toBe(true);
      expect(validation.hasDuplicates).toBe(false);
    }
  });

  it('5. should search for route by query, then filter travel plans containing that route (Planner + Search)', async () => {
    // 1. Fuzzy search route
    const routes = fuzzySearchRoutes(mockDb.routes, 'Gris');
    expect(routes).toHaveLength(1);
    const grisRoute = routes[0];

    // 2. Plan trip from West Morelia to East Morelia
    const origin: [number, number] = [-101.210, 19.702];
    const dest: [number, number] = [-101.180, 19.702];
    const plans = await planTrip(origin, dest);

    // 3. Find if Gris route is recommended in the plans
    const grisPlan = plans.find((p) =>
      p.segments.some((s) => s.routeId === grisRoute.id)
    );
    expect(grisPlan).toBeDefined();
    const rideSeg = grisPlan?.segments.find((s) => s.type === 'ride');
    expect(rideSeg?.routeId).toBe('ruta-gris-1');
  });
});
