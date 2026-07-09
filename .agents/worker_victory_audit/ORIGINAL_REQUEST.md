## 2026-07-08T05:56:14Z
Perform a thorough forensic integrity check of the entire codebase (`app/`, `lib/`, `scripts/`, `supabase/`, `tests/`).
Run systematic validation checks:
- Check if there are any hardcoded test results, facade/stub logic that mimics correct outputs without executing actual logic, or fabricated verification logs/files.
- Run typecheck (`pnpm typecheck`), linter (`pnpm lint`), and the test suite (`pnpm test` or `pnpm test:unit` + `pnpm test:e2e`) to ensure everything compiles and passes with zero warnings or errors.
Verify that the output files in `public/routes/` and the schema migrations in `supabase/migrations/` match the specifications (no official stops, offset directions `ida`/`vuelta`, Carto Positron map rendering, RLS policies).
Write a comprehensive forensic audit report at `d:\rutasmorelia\.agents\worker_victory_audit\handoff.md` with:
- Verdict (must be a clear and final judgment: CLEAN, INTEGRITY VIOLATION, or CHEATING DETECTED).
- Evidence details of files checked, commands executed, and observations.
Report your final verdict and handoff back to the Project Orchestrator (conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa).
