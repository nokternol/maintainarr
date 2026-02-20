---
name: maintainarr-tdd
description: Maintainarr-specific wrappers for TDD. Combines global Matt Pocock's TDD philosophy with Maintainarr's specific architecture (MSW, Vitest, Awilix). Use this whenever doing feature development in this repository.
---

# Maintainarr Test-Driven Development (TDD)

## The Philosophy
You MUST follow the core philosophy and vertical-slicing rules defined in `~/.agents/skills/tdd/SKILL.md` (Matt Pocock's TDD skill). 
Specifically, use **Vertical Slices** via tracer bullets (one test, one implementation, repeat).

## The Maintainarr Implementation
When applying TDD to this repository, you must map the general TDD principles to the following concrete project patterns.

### 1. Test Environments & Helpers
- **Client Code (`src/**`)**: Runs in the `happy-dom` environment. You must use `tests/helpers/component.tsx` (`render`, `setupUser`). MSW will automatically intercept HTTP requests.
- **Server Code (`server/**`)**: Runs in the `node` environment. You must use `tests/helpers/api.ts` (`createApiClient`, `expectSuccessResponse`).

### 2. Mocks
- **NEVER** import MSW (`msw` package) directly into application code (`src/` or `server/`).
- Always define shared HTTP handlers in `tests/mocks/handlers/` (e.g., `tests/mocks/handlers/auth.ts`).

### 3. Styling & Theming
- **Global Theme Management**: All theme changes, layer adjustments, or color intentions MUST be managed globally via the Tailwind configuration or global theme files, rather than hardcoding utility classes directly into components.
- Modular styling should reference these global "intents" (e.g., `text-primary`, `bg-surface-card`) so that the overall theme can be easily adjusted across the entire application simultaneously.

### 4. Execution (The Tight TDD Loop)
When doing Red-Green-Refactor, use **Vitest** on the specific file you are working on to keep feedback immediate:
```bash
# Run tests for a specific file
yarn test:run <test_file_path>
```
*(Optionally, use `yarn test <test_file_path>` for watch mode if manually testing UI side-by-side, but prefer `test:run` for agentic single-shot validations via run_command).*

### 5. Completion (The Refactor/Done Stage)
Once your specific file's tests pass (GREEN), and you have cleaned up the implementation (REFACTOR), you MUST verify that your changes didn't break anything else in the repository.
You cannot consider a feature "Done" until you pass the God Script:
```bash
yarn verify:fast
```
*(This will run Biome lint/format, TypeScript typechecking, and all unit tests without invoking Cypress).*

## Step-by-Step TDD Agent Flow
1. **RED**: Write the test that asserts the behavior using `tests/helpers/*`.
2. Run `yarn test:run <test_file_path>` -> Ensure it fails.
3. **GREEN**: Implement minimal code in the source file. Register Awilix services or MSW handlers.
4. Run `yarn test:run <test_file_path>` -> Ensure it passes.
5. **REFACTOR**: Extract duplication, deepen modules, ensure SOLID principles.
6. Run `yarn verify:fast` -> Fix any global types or lint issues.
