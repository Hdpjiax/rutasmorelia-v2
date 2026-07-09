# Test Infrastructure - Rutas Morelia

This document defines the testing strategy, architecture, and standards for the Rutas Morelia project. All implementations must adhere to this document, ensuring comprehensive test coverage, deterministic results, and genuine logic verification (no dummy/facade implementations).

---

## 1. Test Philosophy

Our testing philosophy is built upon three core pillars:
1. **Behavior-Oriented Testing**: Tests must focus on verifying user-visible behaviors, domain calculations, and end-to-end integration flows rather than implementation details. If a test fails, it must directly indicate that some user-facing functionality or core business logic is broken.
2. **Zero Hardcoded Facades**: No test, mock, or implementation is allowed to bypass logic with pre-determined hardcoded results. Mocking must be restricted to external boundary interfaces (e.g., Supabase network calls, MapLibre WebGL canvas context) while preserving internal data processing and state flows.
3. **Structured Testing Pyramid**:
   - **Unit Tests (`tests/unit/*`)**: Executed via **Vitest** for fast, local validation of deterministic GIS calculations, Travel Planner routing logic, fuzzy search functions, and UI helpers.
   - **End-to-End Tests (`tests/e2e/*`)**: Executed via **Playwright** to validate user flows, map interaction events, network synchronization with Supabase, auth states, and UI selector contracts.

---

## 2. Feature Inventory (5 Key Features)

The testing infrastructure covers these 5 critical features of Rutas Morelia:

### A. Map Route Rendering
- **Scope**: MapLibre GL JS integration, layer creation, and style conformance.
- **Verification points**:
  - Loading of `public/routes/{id}.geojson` and `/public/routes/index.json`.
  - Application of the Carto Positron white base map style.
  - Proper line casing rendering (thick outline + colored inner line).
  - Sentido direction arrows (`ida` vs `vuelta`) displayed on line segments.
  - Text labels for directions at appropriate zoom levels.
- **Test Strategy**: Unit tests mock MapLibre map instance initialization and check geojson validation helpers. E2E tests load the page, verify canvas presence, mock geojson file endpoints, and verify rendering layers.

### B. Supabase DB & Auth
- **Scope**: Database tables, Row Level Security (RLS) policies, spatial RPC functions, and Auth flows.
- **Verification points**:
  - Direct database querying of tables (`routes`, `route_shapes`, `route_transfer_points`).
  - Spatial RPC execution (`get_routes_near_point`, `get_transfer_points`).
  - Sign-in / Sign-up workflow, session persistence, and logout.
  - RLS policies (e.g., public read-only for active routes, authenticated write-only for editor tools).
- **Test Strategy**: Unit tests mock the `@supabase/supabase-js` client responses for frontend components. Integration tests execute migrations and test SQL commands or mock PostgreSQL actions. E2E tests automate the login/signup form interactions and verify session tokens.

### C. GIS Pipeline
- **Scope**: Extraction, matching, validation, and serialization of geographic route files.
- **Verification points**:
  - Reading from raw inputs (KML, GPKG, etc.).
  - Map-matching line coordinates to OpenStreetMap (OSM) streets via local Valhalla `trace_route` / OSRM API.
  - Geometric validation (strict street alignment, no straight lines, no jumps).
  - QA status updates (`approved` vs `needs_review`).
  - Generation of valid GeoJSON outputs.
- **Test Strategy**: Python/TypeScript unit tests process sample KML files, check Valhalla input-output formatting, and ensure the resulting GeoJSON adheres strictly to spatial schemas.

### D. Travel Planner
- **Scope**: Origin/Destination matching, virtual boarding/alighting point computations, and path calculation.
- **Verification points**:
  - Projection of arbitrary coordinates to the nearest active route line (within search radius).
  - Determination of virtual boarding and alighting points (avoiding official stop terminology).
  - Single-route direct paths vs multi-route transfer paths.
  - Step-by-step route descriptions (walk directions, route boarding, transfer location, final walk).
- **Test Strategy**: Unit tests check `planTrip` logic against pre-defined route layouts. Integration/E2E tests assert planner results given selected origin/destination points on the map.

### E. Route Search & Favorites
- **Scope**: Fuzzy search list, autocomplete, and favorites storage.
- **Verification points**:
  - Input auto-suggestions when typing route names or landmarks.
  - Fuzzy matching sorting logic (using Fuse.js or PostgreSQL `ilike`/trigram search).
  - Addition and removal of routes to favorites.
  - Favorites persistence (localStorage for guest users, Supabase Sync for authenticated users).
- **Test Strategy**: Unit tests verify search ranking, edge cases (empty inputs, special characters), and storage synchronize helpers. E2E tests type into search fields, select results, click favorite buttons, and check persists across page reloads.

---

## 3. Test Architecture & Directory Structure

Tests are split between Unit/Integration and End-to-End tests, located in the root of the project:

```
rutasmorelia/
├── tests/
│   ├── unit/
│   │   ├── placeholder.test.ts          # Vitest placeholder test
│   │   ├── planner.test.ts              # Unit test for Travel Planner
│   │   └── ...                          # Other unit tests
│   ├── e2e/
│   │   ├── placeholder.spec.ts          # Playwright placeholder test
│   │   ├── auth.spec.ts                 # Playwright test for Supabase Auth
│   │   └── ...                          # Other E2E tests
├── vitest.config.ts                     # Vitest Configuration
└── playwright.config.ts                 # Playwright Configuration
```

### Mocking Strategies
1. **MapLibre GL JS**: Mocked in unit/integration tests to avoid WebGL context dependency.
2. **Supabase Client**: Mocked in unit/integration tests using a structured helper that returns mock JSON arrays conforming to database schemas. In E2E tests, network calls are intercepted using Playwright's `page.route` or hit a local/sandbox Supabase environment.
3. **Valhalla/OSRM**: GIS pipeline tests mock HTTP request/response payloads from Valhalla/OSRM local server endpoints.

---

## 4. UI Selector Contract

To prevent tests from breaking due to styling or layout changes, all UI components must expose semantic `data-testid` attributes. Developers must use these selectors in test scripts.

| Element / Component | Selector Pattern | Purpose |
|---------------------|------------------|---------|
| Map Container | `data-testid="map-container"` | MapLibre wrapper element |
| Origin Input | `data-testid="search-origin"` | Input field for origin search |
| Destination Input | `data-testid="search-destination"` | Input field for destination search |
| Autocomplete Dropdown | `data-testid="search-autocomplete"` | Container displaying suggestions |
| Travel Planner Results | `data-testid="trip-planner-results"` | Container showing suggested routes |
| Favorite Button (Route) | `data-testid="favorite-button-{routeId}"` | Button to toggle route favorite |
| Route Item (List) | `data-testid="route-item-{routeId}"` | Container representing a single route |
| Toggle Direction Button | `data-testid="toggle-direction-{routeId}"` | Button to switch between `ida` and `vuelta` |
| Auth Email Input | `data-testid="login-email"` | Email input for login |
| Auth Password Input | `data-testid="login-password"` | Password input for login |
| Auth Submit Button | `data-testid="login-submit"` | Button to submit login form |
| User Profile Header | `data-testid="user-profile-header"` | Display for authenticated user status |
