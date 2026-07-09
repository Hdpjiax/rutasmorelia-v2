# Scope: E2E Test Track

## Architecture
The E2E test suite evaluates the correctness of Rutas Morelia's key features in an opaque-box manner.
The test suite consists of two main testing frameworks:
1. **Playwright**: For frontend browser interaction (UI layout, MapLibre rendering behaviors, Travel Planner GUI, Route Search and Favorites interaction).
2. **Vitest**: For database RPC/schema rules, Auth logic, and GIS pipeline correctness, as these can be tested programmatically and quickly without loading full web pages.

## Feature Inventory
We identify 5 primary features to test:
1. **Map Route rendering (MR)**: Displaying routes as color-coded lines, dark casing, direction arrows, and labels (ida/vuelta).
2. **Supabase DB & Auth (DB)**: Table structures, security policies (RLS), Google Auth flow integration, and spatial query RPCs.
3. **GIS Pipeline (GI)**: Local Python processing, OSM validation via Valhalla/OSRM, and route export to geojson.
4. **Travel Planner (TP)**: Proximity-based transit planner with virtual transfer points (no official stops), displaying steps.
5. **Route Search & Favorites (SF)**: Route autocomplete, recent searches, and adding/retrieving favorites.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | Test Infra Design | Write `TEST_INFRA.md` at root, define folder structure, and plan all 60 test cases. | None | DONE | aa589ef5-7b83-4ab8-83a3-df5af5b9bd9d |
| 2 | Environment Setup | Install Vitest, Playwright, configure runners in `package.json`, and set up config files. | M1 | DONE | aa589ef5-7b83-4ab8-83a3-df5af5b9bd9d |
| 3 | Tier 1 Tests | Implement 25+ Feature Coverage tests (5 per feature). | M2 | DONE | 78afa336-6ae3-421d-8024-476d77a783e8 |
| 4 | Tier 2 Tests | Implement 25+ Boundary & Edge Case tests (5 per feature). | M3 | DONE | 78afa336-6ae3-421d-8024-476d77a783e8 |
| 5 | Tier 3 Tests | Implement 5+ Cross-Feature Combination tests. | M4 | DONE | 78afa336-6ae3-421d-8024-476d77a783e8 |
| 6 | Tier 4 Tests | Implement 5+ Real-world Application Scenario tests. | M5 | DONE | 78afa336-6ae3-421d-8024-476d77a783e8 |
| 7 | Verification & Publish | Execute all tests, verify correctness, and publish `TEST_READY.md`. | M6 | IN_PROGRESS | ae2726e0-79b3-40ae-88f6-93cfb0936826 |

## Interface Contracts
- **Test Runner API**:
  - `pnpm test:e2e` runs the E2E tests (Playwright).
  - `pnpm test:unit` or `pnpm test:backend` runs the unit/integration tests (Vitest).
  - `pnpm test` runs both suites in sequence.
