## 2026-07-08T05:39:24Z

Your working directory is d:\rutasmorelia\.agents\worker_m1_m2_setup.
Your identity is worker_m1_m2_setup.
Your objectives are:
1. Design and write d:\rutasmorelia\TEST_INFRA.md at the project root following the guidelines in AGENTS.md, ORIGINAL_REQUEST.md, and our project scope. Include the test philosophy, a feature inventory of the 5 key features (Map Route rendering, Supabase DB & Auth, GIS Pipeline, Travel Planner, Route Search & Favorites), test architecture, test cases layout, and the UI selector contract (e.g., specific data-testid elements).
2. Install test dependencies in the project:
   - Vitest: `vitest` (as a devDependency)
   - Playwright: `@playwright/test` (as a devDependency)
   - Any other necessary devDependencies for running typescript tests.
3. Configure Vitest and Playwright:
   - Create `vitest.config.ts` in the root folder.
   - Create `playwright.config.ts` in the root folder.
   - Ensure the Playwright config is set up to run tests under the `tests/e2e` directory and has a `webServer` block pointing to `pnpm dev` or `pnpm build && pnpm start` on port 3000 (with reuse).
   - Ensure Vitest is configured to run tests under `tests/unit`.
4. Update `package.json` with the following scripts:
   - `"test"`: `"vitest run && playwright test"`
   - `"test:unit"`: `"vitest run"`
   - `"test:e2e"`: `"playwright test"`
5. Verify setup:
   - Ensure that `pnpm typecheck` and `pnpm lint` run and pass.
   - Add simple placeholder tests under `tests/unit/placeholder.test.ts` and `tests/e2e/placeholder.spec.ts` to verify the test runners execute correctly.
   - Run `pnpm test` (or have the commands run via standard runner checks) and verify they execute.
6. Write a handoff report at d:\rutasmorelia\.agents\worker_m1_m2_setup\handoff.md detailing what you have done and containing build and run test commands and output results.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
