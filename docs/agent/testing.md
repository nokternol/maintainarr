# Agent Testing Context

The testing architecture across the repository is unified, strictly separated by environment, and relies heavily on MSW.

## Core Philosophical Principles
1. **MSW Sandbox**: MSW is **NEVER** imported in application code. Test setups (Vitest, Cypress, Ladle) initialize their own MSW instance.
2. **Shared Handlers**: All test environments pull from `tests/mocks/handlers/`. Single source of truth.
3. **Double Verification**: "GOD SCRIPTS" (`yarn verify`, `yarn verify:fast`) act as gatekeepers for formatting, typing, unit testing, and E2E.

## Environments
- **Server Tests (`server/**`)**: Run in `node` environment in Vitest. Uses `tests/helpers/api.ts` (`createApiClient`, `expectSuccessResponse`).
- **Client Tests (`src/**`)**: Run in `happy-dom` in Vitest. Uses `tests/helpers/component.tsx` (`render`, `setupUser`).
- **E2E Tests**: Cypress (`cypress/e2e/`).
- **Component Tests**: Ladle (`*.stories.tsx`).

## Adding New Features
Always ensure:
- Appropriate mock handlers are available or added.
- Types match the Zod schemas.
- `yarn verify` succeeds before considering done.
