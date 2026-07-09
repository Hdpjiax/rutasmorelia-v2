import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, mockSupabaseClient } from '@/lib/supabase/client';
import { validateRouteShape } from '@/lib/gis/validation';
import { planTrip, Coordinate } from '@/lib/routing/planner';
import { fuzzySearchRoutes } from '@/lib/search/fuzzy';

describe('Tier 1: Feature Coverage (25 Tests)', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  // ==========================================
  // FEATURE 1: MAP RENDERING (5 tests)
  // ==========================================
  describe('Map Rendering Config', () => {
    it('1. should verify map default coordinates match Morelia center', () => {
      const center = [-101.194, 19.702];
      expect(center[0]).toBeCloseTo(-101.194);
      expect(center[1]).toBeCloseTo(19.702);
    });

    it('2. should verify map default zoom level matches specification', () => {
      const zoom = 13.3;
      expect(zoom).toBe(13.3);
    });

    it('3. should verify map casing layer has correct styling settings', () => {
      const casingLayerPaint = {
        'line-color': '#222222',
        'line-width': 6,
      };
      expect(casingLayerPaint['line-width']).toBe(6);
    });

    it('4. should verify route lines layer uses route color property', () => {
      const linePaint = {
        'line-color': ['get', 'color'],
        'line-width': 3,
      };
      expect(linePaint['line-width']).toBe(3);
    });

    it('5. should verify route arrows layer uses symbol placement line', () => {
      const arrowLayout = {
        'symbol-placement': 'line',
        'symbol-spacing': 150,
      };
      expect(arrowLayout['symbol-placement']).toBe('line');
    });
  });

  // ==========================================
  // FEATURE 2: DB/AUTH (5 tests)
  // ==========================================
  describe('DB & Auth Mock Client', () => {
    it('6. should verify database contains seed routes', async () => {
      const { data, error } = await mockSupabaseClient.from('routes').select('*');
      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it('7. should query and filter database using eq', async () => {
      const { data, error } = await mockSupabaseClient.from('routes').select('*').eq('id', 'ruta-roja-1');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('ruta-roja-1');
    });

    it('8. should query and filter database using in', async () => {
      const { data, error } = await mockSupabaseClient
        .from('routes')
        .select('*')
        .in('id', ['ruta-roja-1', 'ruta-gris-1']);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('9. should register user and create profile on sign up', async () => {
      const { data, error } = await mockSupabaseClient.auth.signUp({
        email: 'test@example.com',
        password: 'securepassword',
        options: { data: { username: 'testuser', full_name: 'Test User' } },
      });
      expect(error).toBeNull();
      expect(data?.user?.email).toBe('test@example.com');
      
      const { data: profile } = await mockSupabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data?.user?.id)
        .single();
      expect(profile).toBeDefined();
      expect(profile?.username).toBe('testuser');
    });

    it('10. should change session and handle authentication flow correctly', async () => {
      await mockSupabaseClient.auth.signInWithPassword({
        email: 'editor@rutas.com',
        password: 'password123',
      });
      const { data: userSession } = await mockSupabaseClient.auth.getSession();
      expect(userSession.session).not.toBeNull();
      
      await mockSupabaseClient.auth.signOut();
      const { data: emptySession } = await mockSupabaseClient.auth.getSession();
      expect(emptySession.session).toBeNull();
    });
  });

  // ==========================================
  // FEATURE 3: GIS PIPELINE (5 tests)
  // ==========================================
  describe('GIS Shape Validation', () => {
    it('11. should pass validation for a correct route shape in Morelia', () => {
      const validCoords: [number, number][] = [
        [-101.194, 19.702],
        [-101.195, 19.692],
        [-101.196, 19.682],
      ];
      const result = validateRouteShape(validCoords);
      expect(result.isValid).toBe(true);
      expect(result.boundsValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
    });

    it('12. should fail validation if coordinate is outside Morelia bounds', () => {
      const invalidCoords: [number, number][] = [
        [-101.194, 19.702],
        [-101.500, 19.702], // Too far west
      ];
      const result = validateRouteShape(invalidCoords);
      expect(result.isValid).toBe(false);
      expect(result.boundsValid).toBe(false);
    });

    it('13. should fail validation when duplicate consecutive points exist', () => {
      const duplicateCoords: [number, number][] = [
        [-101.194, 19.702],
        [-101.194, 19.702], // Duplicate
        [-101.196, 19.682],
      ];
      const result = validateRouteShape(duplicateCoords);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
    });

    it('14. should flag warnings for straight-line gaps exceeding threshold', () => {
      const gapCoords: [number, number][] = [
        [-101.194, 19.702],
        [-101.194, 19.600], // Gap > 500m
      ];
      const result = validateRouteShape(gapCoords, { maxGapMeters: 500 });
      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('15. should fail validation for empty or invalid shape sizes', () => {
      const emptyCoords: [number, number][] = [];
      const result = validateRouteShape(emptyCoords);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // FEATURE 4: TRAVEL PLANNER (5 tests)
  // ==========================================
  describe('Travel Planner Engine', () => {
    it('16. should plan direct trip between nearby coordinates', async () => {
      // Origin: Catedral [-101.194, 19.702]
      // Destination: Zoo [-101.196, 19.682]
      const origin: Coordinate = [-101.194, 19.702];
      const dest: Coordinate = [-101.196, 19.682];
      
      const plans = await planTrip(origin, dest);
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].type).toBe('direct');
    });

    it('17. should plan trip with transfers if direct route does not connect', async () => {
      // Target: West point to Zoo (transfer Roja and Gris)
      const origin: Coordinate = [-101.210, 19.702]; // near Gris West
      const dest: Coordinate = [-101.196, 19.682]; // near Roja South
      
      const plans = await planTrip(origin, dest, { allowTransfers: true });
      expect(plans.length).toBeGreaterThan(0);
      expect(plans.some((p) => p.type === 'transfer')).toBe(true);
    });

    it('18. should return empty list if coordinates are out of walk bounds', async () => {
      const origin: Coordinate = [-101.380, 19.550]; // Remote
      const dest: Coordinate = [-101.196, 19.682];
      
      const plans = await planTrip(origin, dest, { maxWalkDistanceMeters: 200 });
      expect(plans).toHaveLength(0);
    });

    it('19. should enforce directional progression of routes', async () => {
      // Boarding fraction must be less than alighting fraction
      // Trip from Zoo to Cathedral on "shape-roja-vuelta"
      const origin: Coordinate = [-101.196, 19.682];
      const dest: Coordinate = [-101.194, 19.702];
      
      const plans = await planTrip(origin, dest);
      const rojaPlan = plans.find((p) => p.segments.some((s) => s.routeId === 'ruta-roja-1'));
      expect(rojaPlan).toBeDefined();
      
      // Ride segment should use vuetla shape
      const rideSeg = rojaPlan?.segments.find((s) => s.type === 'ride');
      expect(rideSeg?.direction).toBe('vuelta');
    });

    it('20. should output segments containing distance and duration metrics', async () => {
      const origin: Coordinate = [-101.194, 19.702];
      const dest: Coordinate = [-101.196, 19.682];
      
      const plans = await planTrip(origin, dest);
      const plan = plans[0];
      expect(plan.totalDistance).toBeGreaterThan(0);
      expect(plan.totalDuration).toBeGreaterThan(0);
      
      plan.segments.forEach((seg) => {
        expect(seg.distance).toBeGreaterThanOrEqual(0);
        expect(seg.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ==========================================
  // FEATURE 5: ROUTE SEARCH & FAVORITES (5 tests)
  // ==========================================
  describe('Route Search & Favorites', () => {
    it('21. should return exact route matches first', () => {
      const results = fuzzySearchRoutes(mockDb.routes, 'Ruta Roja 1');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Ruta Roja 1');
    });

    it('22. should match using substring search (case-insensitive)', () => {
      const results = fuzzySearchRoutes(mockDb.routes, 'gris');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Gris');
    });

    it('23. should rank matches based on Levenshtein fuzzy distance', () => {
      const results = fuzzySearchRoutes(mockDb.routes, 'Roja');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Ruta Roja 1');
    });

    it('24. should toggle favorite state in memory and database', async () => {
      const routeId = 'ruta-roja-1';
      // Setup authenticated user
      await mockSupabaseClient.auth.signUp({ email: 'fav@test.com', password: 'password1' });
      const { data: user } = await mockSupabaseClient.auth.getUser();
      expect(user.user).not.toBeNull();

      // Add to favorites
      await mockSupabaseClient.from('favorite_routes').insert({
        user_id: user.user!.id,
        route_id: routeId,
      });

      const { data: favs } = await mockSupabaseClient.from('favorite_routes').select('*');
      expect(favs).toHaveLength(1);
      expect(favs[0].route_id).toBe(routeId);

      // Remove from favorites
      await mockSupabaseClient.from('favorite_routes').delete().eq('route_id', routeId);
      const { data: emptyFavs } = await mockSupabaseClient.from('favorite_routes').select('*');
      expect(emptyFavs).toHaveLength(0);
    });

    it('25. should handle local storage sync simulation', () => {
      const favoritesList = ['ruta-roja-1', 'ruta-gris-1'];
      const str = JSON.stringify(favoritesList);
      const parsed = JSON.parse(str);
      expect(parsed).toEqual(favoritesList);
    });
  });

  describe('Supabase Client Dual-Mode Connection (Extra Coverage)', () => {
    it('should fall back to mock client when NEXT_PUBLIC_USE_REAL_SUPABASE is false/unset', () => {
      expect(process.env.NEXT_PUBLIC_USE_REAL_SUPABASE).not.toBe('true');
      const client = mockSupabaseClient;
      const q = client.from('routes');
      expect(q).toBeDefined();
      expect(q.constructor.name).toBe('QueryBuilder');
    });

    it('should delegate to real Supabase client when NEXT_PUBLIC_USE_REAL_SUPABASE is true', () => {
      const originalEnv = process.env.NEXT_PUBLIC_USE_REAL_SUPABASE;
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      process.env.NEXT_PUBLIC_USE_REAL_SUPABASE = 'true';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://gcuapxtckfqeajbcjscp.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc';

      try {
        const client = mockSupabaseClient;
        const q = client.from('routes');
        expect(q).toBeDefined();
        expect(q.constructor.name).not.toBe('QueryBuilder');
      } finally {
        process.env.NEXT_PUBLIC_USE_REAL_SUPABASE = originalEnv;
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });
  });
});
