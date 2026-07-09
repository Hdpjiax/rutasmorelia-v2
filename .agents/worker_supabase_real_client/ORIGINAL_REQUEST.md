## 2026-07-08T05:52:58Z

You are a worker assigned to implement the real Supabase Cloud database connection.
Your working directory is d:\rutasmorelia\.agents\worker_supabase_real_client.

Your objective is to:
1. Refactor `lib/supabase/client.ts` to support both the mock database (in-memory) and the real Supabase Cloud connection.
2. If `process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true'`, the client should delegate calls to a real Supabase client initialized via `createClient` from `@supabase/supabase-js` using `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` for service-role actions).
3. If the environment variable is not set, or is false (which is the case during unit/E2E testing), it must fall back to the `mockSupabaseClient` so that all existing tests pass cleanly without external network dependency.
4. Ensure all database methods and auth methods inside `mockSupabaseClient` delegate correctly to the real Supabase client if the flag is active.
5. Verify your changes do not break the project compilation: run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Confirm that all 60 tests pass.
6. Deliver a handoff.md report with files modified and verified test output back to Project Orchestrator (conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa).

DO NOT CHEAT. The integration must be authentic and allow connecting to the real Supabase Cloud instance when the flag is enabled.
