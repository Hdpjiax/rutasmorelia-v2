# Original User Request

## Initial Request — 2026-07-07T23:38:02-06:00

Rutas Morelia: A Next.js web application for visualizing public transit routes in Morelia and planning trips by origin-destination, with strict GIS validation and no official stops.

Working directory: d:\rutasmorelia
Integrity mode: development

## Requirements

### R1. Local Environment Setup & Verification (Fase 1)
- [x] Verify Windows and WSL2 dependencies.
- [x] Initialize Next.js App Router project in the root folder with Tailwind CSS, TypeScript, and shadcn/ui.
- [x] Setup environment variables (`.env.local`, `.env-valhalla`).
- [x] Exclude external skill files from TypeScript and ESLint configs.
- [x] Validate build (`pnpm typecheck`, `pnpm lint`, `pnpm build` pass).

### R2. Supabase Cloud Integration (Fase 2)
- Configure Supabase database schema, PostGIS, and migrations (profiles, routes, route_variants, route_shapes, route_segments, route_transfer_points, places, favorite_places, favorite_routes, recent_searches, dataset_versions, gis_quality_reports).
- Set up Supabase Auth with Google login.
- Implement Row Level Security (RLS) policies.
- Implement RPC SQL functions for backend spatial queries.

### R3. Map UI with MapLibre GL JS (Fase 3)
- Render MapLibre GL JS map using Carto Positron basemap.
- Display routes as color-coded lines with dark casing, direction arrows, and labels.
- Follow mobile-first design using standard Tailwind CSS and shadcn/ui.

### R4. GIS Processing & Validation (Fase 4 & 5)
- Extract raw formats (KML, GPKG, etc.) and validate they match the OSM street network using local Valhalla/OSRM.
- Ensure every route has exactly two directions: ida and vuelta.
- Export approved routes to `/public/routes/{id}.geojson`.

### R5. Origin-Destination Travel Planner (Fase 6)
- Provide travel planning using proximity to routes and virtual transfer points (no official stops).

## Acceptance Criteria

### Technical Integrity
- [ ] `pnpm typecheck` runs and passes successfully.
- [ ] `pnpm lint` runs and passes successfully.
- [ ] All unit and Playwright tests pass.
- [ ] The app is deployable to Vercel and connects to Supabase Cloud.

### Map & Route Visualization
- [ ] Map loads Carto Positron basemap.
- [ ] Routes are styled with custom color lines, dark casing, direction arrows on line, and text labels "Ida"/"Vuelta".
- [ ] Every active route contains exactly two directions (ida and vuelta).
- [ ] No direct straight-line transitions or "jumped" streets exist in published routes.
