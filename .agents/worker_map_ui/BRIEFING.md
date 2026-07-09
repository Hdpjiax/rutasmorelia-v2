# BRIEFING — 2026-07-08T05:51:00Z

## Mission
Implement the MapLibre GL JS component inside the Next.js app with Carto Positron basemap, route rendering logic (4 layers: casing, route, arrows, text labels), markers, responsive UI (desktop floating panel, mobile sliding sheet), and verification using mock data.

## 🔒 My Identity
- Archetype: worker_map_ui
- Roles: implementer, qa, specialist
- Working directory: d:\rutasmorelia\.agents\worker_map_ui
- Original parent: d301522e-7f97-4367-96f0-5ce8124014fa
- Milestone: Milestone 3: Map UI Component

## 🔒 Key Constraints
- Basemap: Carto Positron GL style.
- Initial center: [-101.194, 19.702], Zoom: 13.3.
- MapLibre GL JS Route layers in order: `route-lines-casing`, `route-lines`, `route-arrows`, `route-text-labels`.
- Markers: Origin, Destination, Virtual Boarding, Virtual Alighting, Transfer.
- UI: Full screen map, floating search panel (desktop), sliding drawer/sheet (mobile) using Tailwind + shadcn/ui.
- Mock route data: `/public/routes/index.json` and `/public/routes/test-route-1.geojson` (must contain exactly two features for "ida" and "vuelta").
- Verify via pnpm build / pnpm typecheck / pnpm lint.
- No paradas oficiales. Only virtual points ("punto sugerido").

## Current Parent
- Conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa
- Updated: not yet

## Task Summary
- **What to build**: Next.js App Router Map Component using MapLibre GL JS, markers, responsive search panel/sheet, and mock route visualization.
- **Success criteria**: Successful typecheck and build, correct layers ordering and styling, proper responsive layout, and correct mock GeoJSON structure.
- **Interface contracts**: `d:\rutasmorelia\AGENTS.md` and `d:\rutasmorelia\.agents\skills\rutas-morelia-map-ui\SKILL.md`.
- **Code layout**: Next.js project directory structure.

## Key Decisions Made
- Used Carto Positron vector JSON style natively with MapLibre GL JS.
- Implemented data-driven GeoJSON styling for both active selected route shapes and calculated trip plan lines.
- Filtered walk segments from main route rendering layers and introduced a custom dashed `route-lines-walk` layer.
- Programmed a custom collapsible mobile bottom drawer using simple React state (`isMobileExpanded`) and Tailwind transitions.
- Placed custom HTML markers with emojis for Origin (🟢), Destination (🏁), Boarding (🚶‍♂️), Alighting (👋), and Transfer (🔄).

## Loaded Skills
- **Source**: d:\rutasmorelia\.agents\skills\rutas-morelia-map-ui\SKILL.md
- **Local copy**: d:\rutasmorelia\.agents\skills\rutas-morelia-map-ui\SKILL.md
- **Core methodology**: MapLibre GL JS clean Carto Positron UI, 4 ordered layers for routes, virtual boarding/alighting markers, responsive layout (floating search/sliding drawer).

## Change Tracker
- **Files modified**:
  - `lib/supabase/client.ts` — Fixed type sorting error; added `test-route-1` seed data.
  - `app/page.tsx` — Set up MapLibre GL component, 4 route layers, markers, responsive UI.
- **Build status**: Pass (Next.js compilation, typecheck, linting, and all 55 unit tests passed).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: Pass (55/55 unit tests passed)
- **Lint status**: 0 errors, 0 warnings
- **Tests added/modified**: Covered by existing test suites verifying route list rendering and client queries.

## Artifact Index
- `d:\rutasmorelia\public\routes\index.json` — Mock route index file
- `d:\rutasmorelia\public\routes\test-route-1.geojson` — Mock route geometry containing ida and vuelta features
- `d:\rutasmorelia\.agents\worker_map_ui\handoff.md` — Handoff documentation
