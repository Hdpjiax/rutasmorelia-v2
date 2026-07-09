## 2026-07-07T23:46:26Z

You are a worker assigned to Milestone 3: Map UI Component.
Your working directory is d:\rutasmorelia\.agents\worker_map_ui.
You MUST load and follow the domain skill rutas-morelia-map-ui located at d:\rutasmorelia\.agents\skills\rutas-morelia-map-ui\SKILL.md.

Your objective is to:
1. Set up the MapLibre GL JS component inside the Next.js app (using tailwind, TypeScript, and shadcn/ui components).
2. Configure the basemap using Carto Positron: https://basemaps.cartocdn.com/gl/positron-gl-style/style.json, initial center [-101.194, 19.702], and zoom 13.3.
3. Build the route rendering logic with exactly 4 layers in order:
   - `route-lines-casing`: Dark outline (casingColor, e.g. #222222) with a thickness slightly larger than the inner line for readability.
   - `route-lines`: Color-coded line representing the transit line (using properties.color).
   - `route-arrows`: SVG triangular white arrows with a black border on the line (symbol-placement: line, spacing based on zoom level).
   - `route-text-labels`: Text displaying 'Ida' or 'Vuelta' using text-field = properties.name, with a text halo for legibility.
4. Implement markers for Origin, Destination, Virtual Boarding Point, Virtual Alighting Point, and Transfer Point.
5. Create a responsive UI: full screen map, floating search panel in desktop, and a sliding drawer/sheet in mobile using Tailwind and shadcn/ui.
6. Create temporary mock route data in `/public/routes/index.json` and `/public/routes/test-route-1.geojson` (which contains exactly two features for "ida" and "vuelta") to demonstrate that the map renders both directions with casing, arrows, and labels correctly.
7. Run pnpm build / pnpm typecheck / pnpm lint to verify that your map component integrates cleanly without typescript or build errors.
8. Write a handoff.md report with screenshots description, file paths, and build outputs. Send a completion message back to Project Orchestrator (conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa).

DO NOT CHEAT. Hardcoding of test results is strictly forbidden. The logic must be fully functional and integrated with real MapLibre GL JS library.
