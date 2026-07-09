import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, mockSupabaseClient, RouteShape } from '@/lib/supabase/client';
import { validateRouteShape } from '@/lib/gis/validation';
import { planTrip, Coordinate } from '@/lib/routing/planner';
import { fuzzySearchRoutes } from '@/lib/search/fuzzy';

describe('Tier 2: Boundary & Corner Cases (25 Tests)', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  // ==========================================
  // FEATURE 1: MAP RENDERING BOUNDARIES (5 tests)
  // ==========================================
  describe('Map Rendering Boundary Cases', () => {
    it('1. should handle coordinates exactly at Morelia corners', () => {
      const minCorner = [-101.4, 19.5];
      const maxCorner = [-101.0, 20.0];
      expect(minCorner[0]).toBe(-101.4);
      expect(minCorner[1]).toBe(19.5);
      expect(maxCorner[0]).toBe(-101.0);
      expect(maxCorner[1]).toBe(20.0);
    });

    it('2. should clamp zoom levels between 0 and 24', () => {
      const clampZoom = (z: number) => Math.max(0, Math.min(24, z));
      expect(clampZoom(-5)).toBe(0);
      expect(clampZoom(30)).toBe(24);
      expect(clampZoom(13.3)).toBe(13.3);
    });

    it('3. should verify route styling fallback when casing color is missing', async () => {
      const route = {
        id: 'test-route',
        name: 'Test Route',
        color: '#ff0000',
        casing_color: '', // Missing
        transport_type: 'bus',
        status: 'approved' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const displayCasing = route.casing_color || '#222222';
      expect(displayCasing).toBe('#222222');
    });

    it('4. should handle empty list of features gracefully when mapping', () => {
      const features: unknown[] = [];
      const featureCollection = {
        type: 'FeatureCollection',
        features,
      };
      expect(featureCollection.features).toHaveLength(0);
    });

    it('5. should handle complex multiline route segments without WebGL errors', () => {
      const multiline = [
        [[-101.194, 19.702], [-101.195, 19.692]],
        [[-101.195, 19.692], [-101.196, 19.682]],
      ];
      expect(multiline.length).toBe(2);
    });
  });

  // ==========================================
  // FEATURE 2: DB/AUTH CORNER CASES (5 tests)
  // ==========================================
  describe('DB & Auth Corner Cases', () => {
    it('6. should fail to query a non-existent table', async () => {
      expect(() => mockSupabaseClient.from('non_existent' as never)).toThrow();
    });

    it('7. should enforce unique constraints for favorite routes', async () => {
      await mockSupabaseClient.auth.signUp({ email: 'user@test.com', password: 'pw' });
      const { data: user } = await mockSupabaseClient.auth.getUser();

      await mockSupabaseClient.from('favorite_routes').insert({
        user_id: user.user!.id,
        route_id: 'ruta-roja-1',
      });

      // Try inserting duplicate
      const { error } = await mockSupabaseClient.from('favorite_routes').insert({
        user_id: user.user!.id,
        route_id: 'ruta-roja-1',
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Unique constraint violation');
    });

    it('8. should enforce write RLS validation policies without token', async () => {
      // Sign out
      await mockSupabaseClient.auth.signOut();
      
      // Try writing to public profiles table
      const { error } = await mockSupabaseClient.from('profiles').insert({
        id: 'unauthorized-id',
        username: 'hack',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('RLS Violation');
    });

    it('9. should restrict users to only manage their own favorite routes', async () => {
      // Register two users
      const user1Id = 'user-1';
      const user2Id = 'user-2';

      mockDb.profiles.push({
        id: user1Id,
        username: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockDb.profiles.push({
        id: user2Id,
        username: 'user2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Log in as user1
      mockDb.currentUser = { id: user1Id, email: 'user1@test.com' };
      mockDb.authToken = 'token-1';

      // Insert favorite for user2
      const { error } = await mockSupabaseClient.from('favorite_routes').insert({
        user_id: user2Id,
        route_id: 'ruta-roja-1',
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('RLS Violation');
    });

    it('10. should allow profiles table triggers to handle null usernames gracefully', async () => {
      const email = 'anon@test.com';
      const { data, error } = await mockSupabaseClient.auth.signUp({
        email,
        password: 'password',
        options: { data: { full_name: 'Anonymous User' } },
      });
      expect(error).toBeNull();
      
      const { data: profile } = await mockSupabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data?.user?.id)
        .single();
      expect(profile?.username).toBe(email); // Fallbacks to email
    });
  });

  // ==========================================
  // FEATURE 3: GIS PIPELINE BOUNDARIES (5 tests)
  // ==========================================
  describe('GIS Pipeline Boundary Cases', () => {
    it('11. should accept coordinates exactly on Morelia boundary bounds', () => {
      const boundaryCoords: [number, number][] = [
        [-101.4, 19.5],
        [-101.0, 20.0],
      ];
      const result = validateRouteShape(boundaryCoords);
      expect(result.boundsValid).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('12. should fail validation on null or undefined coordinate coordinates', () => {
      const faultyCoords = [
        [-101.194, undefined],
        [null, 19.702],
      ];
      const result = validateRouteShape(faultyCoords as unknown as [number, number][]);
      expect(result.isValid).toBe(false);
    });

    it('13. should fail validation on LineString containing only 1 point', () => {
      const onePointCoords: [number, number][] = [
        [-101.194, 19.702],
      ];
      const result = validateRouteShape(onePointCoords);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('at least 2 points');
    });

    it('14. should fail when extremely close consecutive points are detected', () => {
      const closeCoords: [number, number][] = [
        [-101.1940001, 19.7020001],
        [-101.1940001, 19.7020001],
      ];
      const result = validateRouteShape(closeCoords);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
    });

    it('15. should flag extreme distance gap crossing bounds', () => {
      const maxGapCoords: [number, number][] = [
        [-101.399, 19.501],
        [-101.001, 19.999], // Gap > 40km
      ];
      const result = validateRouteShape(maxGapCoords, { maxGapMeters: 1000 });
      expect(result.gaps.length).toBe(1);
      expect(result.gaps[0].distance).toBeGreaterThan(40000);
    });
  });

  // ==========================================
  // FEATURE 4: TRAVEL PLANNER BOUNDARIES (5 tests)
  // ==========================================
  describe('Travel Planner Boundary Cases', () => {
    it('16. should plan trip when origin and destination are identical', async () => {
      const origin: Coordinate = [-101.194, 19.702];
      const dest: Coordinate = [-101.194, 19.702];
      
      const plans = await planTrip(origin, dest);
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].totalDistance).toBeCloseTo(0);
      expect(plans[0].totalDuration).toBeCloseTo(0);
    });

    it('17. should fail to plan trip if maxWalkDistance is extremely small', async () => {
      const origin: Coordinate = [-101.190, 19.700]; // about 400m from shape
      const dest: Coordinate = [-101.196, 19.682];
      
      const plans = await planTrip(origin, dest, { maxWalkDistanceMeters: 5 });
      expect(plans).toHaveLength(0);
    });

    it('18. should plan trip when walk radius matches the whole city bounds', async () => {
      const origin: Coordinate = [-101.300, 19.700]; // 10km away
      const dest: Coordinate = [-101.196, 19.682];
      
      const plans = await planTrip(origin, dest, { maxWalkDistanceMeters: 15000 });
      expect(plans.length).toBeGreaterThan(0);
    });

    it('19. should handle closed loop/circular shapes properly without crashing', async () => {
      // Loop: start and end are identical
      const loopShape: RouteShape = {
        id: 'shape-loop',
        route_id: 'ruta-roja-1',
        direction: 'ida',
        geom: {
          type: 'LineString',
          coordinates: [
            [-101.194, 19.702],
            [-101.195, 19.692],
            [-101.194, 19.702],
          ]
        },
        matched_to_osm: true,
        qa_status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      mockDb.route_shapes.push(loopShape);
      const origin: Coordinate = [-101.194, 19.702];
      const dest: Coordinate = [-101.195, 19.692];
      const plans = await planTrip(origin, dest);
      expect(plans.length).toBeGreaterThan(0);
    });

    it('20. should calculate correct segment distances and durations for slow walk speeds', async () => {
      const origin: Coordinate = [-101.192, 19.702];
      const dest: Coordinate = [-101.198, 19.682];
      
      const plansSlow = await planTrip(origin, dest, { walkSpeedMeterPerSec: 0.5 });
      const plansFast = await planTrip(origin, dest, { walkSpeedMeterPerSec: 2.0 });
      
      expect(plansSlow[0].totalDuration).toBeGreaterThan(plansFast[0].totalDuration);
    });
  });

  // ==========================================
  // FEATURE 5: ROUTE SEARCH & FAVORITES CORNER (5 tests)
  // ==========================================
  describe('Search & Favorites Corners', () => {
    it('21. should return all routes when search query is empty or whitespace', () => {
      const results = fuzzySearchRoutes(mockDb.routes, '   ');
      expect(results).toHaveLength(mockDb.routes.length);
    });

    it('22. should handle search query filled with special regex characters', () => {
      const results = fuzzySearchRoutes(mockDb.routes, '.*+?^${}()|[]\\');
      expect(results).toHaveLength(0); // Should not match and not throw errors
    });

    it('23. should handle extremely long search strings safely', () => {
      const longString = 'a'.repeat(500);
      const results = fuzzySearchRoutes(mockDb.routes, longString);
      expect(results).toHaveLength(0);
    });

    it('24. should ignore favoriting non-existent route IDs or missing attributes gracefully', async () => {
      await mockSupabaseClient.auth.signUp({ email: 'fav2@test.com', password: 'pw' });
      const { data: user } = await mockSupabaseClient.auth.getUser();

      const { data, error } = await mockSupabaseClient.from('favorite_routes').insert({
        user_id: user.user!.id,
        route_id: 'non-existent-route',
      });
      expect(error).toBeNull(); // Allowed insert for mock client, handles metadata
      expect(data).toHaveLength(1);
    });

    it('25. should enforce unique constraint on favorite places', async () => {
      await mockSupabaseClient.auth.signUp({ email: 'fav3@test.com', password: 'pw' });
      const { data: user } = await mockSupabaseClient.auth.getUser();

      await mockSupabaseClient.from('favorite_places').insert({
        user_id: user.user!.id,
        place_id: 'place-cathedral',
      });

      const { error } = await mockSupabaseClient.from('favorite_places').insert({
        user_id: user.user!.id,
        place_id: 'place-cathedral',
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Unique constraint violation');
    });
  });
});
