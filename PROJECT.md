# Project: Rutas Morelia

## Architecture
Rutas Morelia is a Next.js web application for visualizing public transit routes in Morelia and planning trips by origin-destination. It uses Supabase Cloud as its backend database and authentication provider, and MapLibre GL JS on the frontend.
Data flow:
1. Raw routes (KML, GPKG, etc.) are processed locally by Python GIS scripts, validated using Valhalla and OSRM, and stored in the Supabase database.
2. Approved routes are exported to `/public/routes/{id}.geojson` for fast static mapping.
3. The frontend displays the routes on MapLibre using a Carto Positron basemap, styled with line casing, arrows, and labels.
4. Users plan trips by selecting origin/destination points. The backend spatial RPC query returns candidate routes, and the frontend computes virtual transfer points and displays the options.

## Code Layout
- `app/` - Next.js App Router pages and layouts.
- `components/` - Shared UI components (ui/, map/, search/, layout/).
- `features/` - Feature modules (auth/, favorites/, gis/, map/, planner/, routes/, search/).
- `lib/` - Shared helper libraries (supabase/, gis/, routing/, search/, validation/).
- `scripts/` - Python and shell scripts for GIS processing, matching, import, and QA.
- `supabase/` - DB migrations, security policies, and seed data.
- `data/` - Input raw routes, processed geoson files, Valhalla/OSRM config/data.
- `public/` - Static assets and routes JSON files (`/public/routes/index.json` and `{routeId}.geojson`).

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | Test Track | Build E2E test cases (Tier 1-4) and publish `TEST_READY.md` | None | PLANNED | - |
| 2 | Setup & Verify | Verify Next.js, tailwind, typescript setup and config files | None | PLANNED | - |
| 3 | Database Schema | Migrate Supabase tables, set up Auth and RLS policies, and spatial RPC functions | M2 | PLANNED | - |
| 4 | Map UI Component | Implement MapLibre GL JS integration with custom Positron style, line casing, direction arrows, and text labels | M2 | PLANNED | - |
| 5 | GIS Pipeline | Create Python scripts to read KML/GPKG, perform Valhalla trace_route/OSRM match validation, and export to public/routes/ | M2 | PLANNED | - |
| 6 | Travel Planner | Implement origin-destination planner using virtual points and route proximity, showing travel steps and suggestions | M3, M5 | PLANNED | - |
| 7 | Search & Favorites | Implement route/place search with autocomplete and recent/favorite storage | M3, M4 | PLANNED | - |
| 8 | E2E Integration | Integrate code and pass 100% of E2E tests, followed by adversarial coverage hardening | M1, M6, M7 | PLANNED | - |

## Interface Contracts

### Frontend Routing ↔ Supabase Database
- Tables:
  - `routes`: id, name, description, color, casing_color, transport_type, status, created_at, updated_at
  - `route_shapes`: id, route_id, direction (ida/vuelta), geom (LineString, EPSG:4326), matched_to_osm (boolean), qa_status (approved/needs_review/rejected)
  - `route_transfer_points`: id, route_id_1, route_id_2, geom (Point, EPSG:4326), name
- RPC Functions:
  - `get_routes_near_point(lng float, lat float, radius_meters float)` -> returns `routes` and projection point.
  - `get_transfer_points(route_id_1 text, route_id_2 text)` -> returns list of intersection geometries.

### Travel Planner ↔ UI
- Planner function: `planTrip(origin: Coordinate, destination: Coordinate, preferences: PlannerPreferences) -> Promise<TripPlan[]>`
- TripPlan fields:
  - `type`: 'direct' | 'transfer'
  - `segments`: list of segments (walk to virtual boarding, take route X, walk to virtual alighting, optional transfer).
  - `boardingPoint`: Coordinate (Virtual Boarding)
  - `alightingPoint`: Coordinate (Virtual Alighting)
