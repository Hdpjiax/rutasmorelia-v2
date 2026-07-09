## 2026-07-08T05:40:26Z
You are a worker assigned to Milestone 2: Database Schema & Supabase.
Your working directory is d:\rutasmorelia\.agents\worker_supabase_db.
Your objective is to:
1. Initialize the PostgreSQL schema for Supabase under `supabase/migrations/`. Use clean SQL files.
2. Enable PostGIS, pg_trgm, and unaccent extensions.
3. Create the following tables (all in the `public` schema):
   - `profiles`: user profiles linked to auth.users.
   - `routes`: transit routes metadata (id, name, description, color, casing_color, transport_type, status, created_at, updated_at).
   - `route_variants`: variants of a route if any.
   - `route_shapes`: geometry lines (id, route_id, direction [ida/vuelta], geom [LineString, 4326], matched_to_osm [boolean], qa_status [approved/needs_review/rejected]).
   - `route_segments`: segment level geometry if needed.
   - `route_transfer_points`: transfer points between routes (id, route_id_1, route_id_2, geom [Point, 4326], name).
   - `places`: system-defined places/landmarks.
   - `favorite_places`: user favorites.
   - `favorite_routes`: user favorite routes.
   - `recent_searches`: search history for a user.
   - `dataset_versions`: to track data imports.
   - `gis_quality_reports`: to log QA validation results.
4. Set up GiST indexes on all spatial/geometry columns (geom columns in route_shapes, route_transfer_points, etc.).
5. Set up Row Level Security (RLS) policies on all tables. Profiles, favorites, and searches must be secured so users can only read/write their own data. Public tables (routes, route_shapes, route_transfer_points, places) must be publicly readable but only writeable by service role/admin.
6. Create spatial RPC SQL functions:
   - Find routes passing within a given distance from a point.
   - Project a point onto a route shape to find the nearest point (virtual boarding/alighting point).
7. Create a database verification script (e.g. `scripts/verify_supabase.ts` or similar) that uses the Supabase service role key in `.env.local` to connect to the Supabase Cloud instance, execute the migration SQL commands (or check if tables are already in place), and verify that RLS works as expected.
8. Run the verification script and verify the tables, indices, and RLS policies are active on the cloud database.
9. Deliver your handoff.md report with command outputs, schema descriptions, and verification results back to Project Orchestrator (conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa).

Integrity Reminder: DO NOT CHEAT. All implementations must be genuine. Do not hardcode query results, bypass RLS check validations, or fabricate verification outputs.
