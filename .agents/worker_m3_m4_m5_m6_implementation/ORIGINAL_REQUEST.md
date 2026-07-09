## 2026-07-08T05:41:20Z
Your working directory is d:\rutasmorelia\.agents\worker_m3_m4_m5_m6_implementation.
Your identity is worker_m3_m4_m5_m6_implementation.

Your objectives are:
1. Create and implement genuine logic libraries under `lib/`:
   - `lib/search/fuzzy.ts`: Performs genuine case-insensitive substring/fuzzy search of routes.
   - `lib/gis/validation.ts`: Performs spatial validation on route shapes (LineStrings), checking coordinate bounds for Morelia (19.5 to 20.0 Lat, -101.4 to -101.0 Lng), checking for duplicate/consecutive points, and finding straight-line gaps.
   - `lib/routing/planner.ts`: Performs origin-destination route planning by finding nearby routes, determining virtual boarding/alighting points (avoiding official stop terms), computing direct and transfer paths, and returning structured travel segments.
   - `lib/supabase/client.ts`: Implements a mock client that mimics the database tables schema, enforces table unique constraints, mock-validates RLS policies (e.g. read public, write requires auth token), and handles SQL-like query filtering.
2. Build a local prototype UI in `app/page.tsx` that links these libraries together:
   - Contains a MapLibre map initialization (`data-testid="map-container"`).
   - Uses origin/destination autocomplete inputs (`data-testid="search-origin"`, `data-testid="search-destination"`) displaying suggestions (`data-testid="search-autocomplete"`).
   - Integrates the planner, showing results in `data-testid="trip-planner-results"`.
   - Allows toggling favorites (`data-testid="favorite-button-{routeId}"`) and saving route favorites in React state/localStorage.
   - Displays route list (`data-testid="route-item-{routeId}"`) and toggling directions (`data-testid="toggle-direction-{routeId}"`).
   - Standard authentication login forms (`data-testid="login-email"`, `data-testid="login-password"`, `data-testid="login-submit"`, `data-testid="user-profile-header"`).
3. Write and implement exactly 60 test cases across 4 tiers:
   - Tier 1: Feature Coverage (25+ tests: 5 tests per feature for Map rendering, DB/Auth, GIS Pipeline, Travel Planner, Route Search & Favorites)
   - Tier 2: Boundary & Corner Cases (25+ tests: 5 tests per feature for bounds, nulls, invalid coordinates, duplicate entities, etc.)
   - Tier 3: Cross-Feature Combinations (5+ tests: search+favorites+map, auth+favorites, planner+map, db+gis, planner+search)
   - Tier 4: Real-world Application Scenarios (5+ tests: Cathedral-to-Zoo journey, GIS upload-to-public, auth-editor-edit, multi-route virtual transfer planner, offline resiliency fallback)
   - Directory structure: unit tests in `tests/unit/*.test.ts` (Vitest), E2E tests in `tests/e2e/*.spec.ts` (Playwright).
4. Run validation:
   - Verify `pnpm typecheck` passes.
   - Verify `pnpm lint` passes.
   - Run `pnpm test` (running both `vitest run` and `playwright test`) and make sure all 60+ tests pass.
5. Create a handoff report at d:\rutasmorelia\.agents\worker_m3_m4_m5_m6_implementation\handoff.md with passing build/test command logs and layout compliance verification.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
