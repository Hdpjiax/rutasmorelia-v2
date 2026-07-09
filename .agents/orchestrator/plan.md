# Orchestration Plan — Rutas Morelia

This plan outlines the steps we will take to execute the Rutas Morelia project using the Project Pattern.

## Strategy & Topology
We will use a Dual Track architecture:
1. **E2E Testing Track**: Build a comprehensive, requirement-driven opaque-box test suite independent of implementation design.
2. **Implementation Track**: Implement Next.js pages, Map UI, Supabase tables/policies, GIS pipelines, routes ingestion and matching, and travel planner.

We will spawn a sub-orchestrator for the **E2E Testing Track** and separate sub-orchestrators/workers for each implementation milestone.

## Steps
- [ ] Step 1: Initialize PROJECT.md with global architecture, milestone decomposition, interface contracts, and code layout.
- [ ] Step 2: Spawn E2E Testing Orchestrator to design and build the E2E test suite (creating `TEST_INFRA.md` and then `TEST_READY.md`).
- [ ] Step 3: Run the implementation milestones sequentially or in parallel.
  - Milestone 1: Environment, config files and setup verification.
  - Milestone 2: Supabase database schema, PostGIS, Auth and SSR config, RLS, and RPC spatial queries.
  - Milestone 3: Map UI component with MapLibre GL JS, Carto Positron style, line rendering, casing, and direction arrows/labels.
  - Milestone 4: GIS Pipeline (Python scripts) for raw route extraction (KML, GeoPackage, etc.), map-matching with local Valhalla/OSRM, and exporting approved routes.
  - Milestone 5: Origin-Destination travel planner algorithm and virtual points/transfer generation.
  - Milestone 6: Autocomplete search, places search, and favorite routes/places user management.
- [ ] Step 4: Final Milestone (Phase 1 and Phase 2) — run and pass 100% of E2E tests, then run adversarial coverage hardening.
- [ ] Step 5: Run Victory Audit and report completion to user.
