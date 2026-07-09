# BRIEFING — 2026-07-08T05:56:00Z

## Mission
Refactor `lib/supabase/client.ts` to support both the mock database (in-memory) and the real Supabase Cloud connection.

## 🔒 My Identity
- Archetype: implementer_qa_specialist
- Roles: implementer, qa, specialist
- Working directory: d:\rutasmorelia\.agents\worker_supabase_real_client
- Original parent: d301522e-7f97-4367-96f0-5ce8124014fa
- Milestone: Real Supabase Client Integration

## 🔒 Key Constraints
- If `process.env.NEXT_PUBLIC_USE_REAL_SUPABASE === 'true'`, delegate calls to real Supabase client initialized via `createClient` using URL and ANON/SERVICE_ROLE key.
- Else fall back to `mockSupabaseClient`.
- Ensure all database and auth methods delegate correctly.
- Verify changes do not break compilation/tests (typecheck, lint, test - all tests must pass).
- No cheating (genuine connection integration).

## Change Tracker
- **Files modified**:
  - `lib/supabase/client.ts`: Refactored to support dual-mode (mock/real) with delegation to `@supabase/supabase-js`.
  - `tests/unit/tier1.test.ts`: Added unit tests for dual-mode behavior.
- **Build status**: PASS
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS (57 unit tests + 5 E2E tests passed)
- **Lint status**: PASS (0 eslint violations)
- **Tests added/modified**: Added new test suite to verify dual-mode fallback and delegation.

## Current Parent
- Conversation ID: d301522e-7f97-4367-96f0-5ce8124014fa
- Updated: yes

## Task Summary
- **What to build**: Dual-mode Supabase client in `lib/supabase/client.ts`.
- **Success criteria**: All tests pass locally using the mock database when the flag is false, and it uses real Supabase client when the flag is true.
- **Interface contracts**: `lib/supabase/client.ts`
- **Code layout**: Next.js App Router

## Key Decisions Made
- Used `SupabaseClient` typing for lazy-instantiated real client instance.
- Typed `mockSupabaseClient.from` as returning `QueryBuilder` with an internal cast to `unknown as QueryBuilder` for the real client query builder to prevent implicit any errors.
- Removed return type annotations from other delegating functions to resolve linter errors.

## Artifact Index
- d:\rutasmorelia\.agents\worker_supabase_real_client\handoff.md — Handoff report for Project Orchestrator
