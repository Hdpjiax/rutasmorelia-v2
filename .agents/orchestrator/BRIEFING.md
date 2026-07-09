# BRIEFING — 2026-07-08T05:38:15Z

## Mission
Orchestrate and coordinate the Rutas Morelia project implementation across all milestones using the Project Pattern.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:\rutasmorelia\.agents\orchestrator
- Original parent: main agent
- Original parent conversation ID: c19a95ac-9f0d-445d-958a-f2bfa062d28c

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: d:\rutasmorelia\PROJECT.md
1. **Decompose**: Decompose the project into milestones (implementation track and E2E testing track).
2. **Dispatch & Execute**:
   - **Delegate (sub-orchestrator)**: For large milestones, spawn a sub-orchestrator for it.
   - **Direct (iteration loop)**: Spawn Explorer -> Worker -> Reviewer -> Challenger -> Auditor.
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns. Write handoff.md, spawn successor.
- **Work items**:
  1. Initialize Project.md [pending]
  2. Setup E2E Test Suite [pending]
  3. Execute Milestones [pending]
- **Current phase**: 1
- **Current focus**: Project initialization and planning

## 🔒 Key Constraints
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Victory Audit is MANDATORY before reporting completion.
- Deploy to Vercel, Supabase in the cloud, Local development in Windows/WSL2.
- No official stops, only virtual points. Ida and vuelta directions.

## Current Parent
- Conversation ID: c19a95ac-9f0d-445d-958a-f2bfa062d28c
- Updated: not yet

## Key Decisions Made
- Use Project Pattern with dual tracks (Implementation and E2E testing).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| sub_orch_e2e | self | E2E Test Suite | completed | 5b9d24f8-9e59-4ec0-a2cc-b5a49b86b302 |
| worker_setup | teamwork_preview_worker | Setup & Verify | completed | 24aedf1f-a197-4d45-aee2-08963eb95986 |
| worker_database | teamwork_preview_worker | Database & Supabase | completed | 9d91d9da-4710-4dff-828b-f32c1c41f3ff |
| worker_map_ui | teamwork_preview_worker | Map UI Component | completed | df330723-3cbb-477a-a79b-351b8d906e07 |
| worker_gis | teamwork_preview_worker | GIS Pipeline | completed | b182eb7a-cfc4-4e75-b81c-b4be42da30f4 |
| worker_supabase_real | teamwork_preview_worker | Supabase Cloud connection | completed | 20061ec8-261c-4d70-a1e1-a21692da6f87 |
| victory_auditor | teamwork_preview_auditor | Forensic Victory Audit | in-progress | 5bece1ad-5e90-456a-b9e7-c143bda07a59 |

## Succession Status
- Succession required: no
- Spawn count: 7 / 16
- Pending subagents: 5bece1ad-5e90-456a-b9e7-c143bda07a59
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-29
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- d:\rutasmorelia\ORIGINAL_REQUEST.md — Original user request
- d:\rutasmorelia\.agents\orchestrator\progress.md — Progress tracking heartbeat
- d:\rutasmorelia\.agents\orchestrator\plan.md — Specific orchestrator plan
- d:\rutasmorelia\.agents\orchestrator\context.md — Context and current state
- d:\rutasmorelia\PROJECT.md — Global project roadmap and architecture
