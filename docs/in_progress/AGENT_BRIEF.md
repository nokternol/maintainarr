# Agent Brief — shared context for the System-Roles & MediaQueryEngine heal

Read this once alongside your phase's `phase-N-prompt.md` (phase-specific seams) and
`phase-N-<name>.md` (the cycles). It holds what applies to **every** phase and is **not** in the
`plan-and-go:tdd` skill, the phase docs, or `CLAUDE.md`.

## Gates (establish before RED)
Run the `node-establish-gates` skill, or confirm green on a clean baseline first:
- `yarn test` (vitest) — the TDD loop driver.
- `yarn typecheck:server` and/or `yarn typecheck:client` (per phase).
- `yarn lint` — this is `biome check --write`; it **auto-modifies files**. Run it deliberately and
  review what it rewrote.

Branch before coding (`feat/<phase-topic>`). Don't start RED until the baseline is green.

## Knowledge graph first
This repo has graphify (`graphify-out/`). For "where is X / how does Y connect", run
`graphify query`/`explain`/`path` before grepping (see `CLAUDE.md`). Run `graphify update .` after code
changes.

## Dependency injection (awilix)
Services resolve from a `Cradle` registered in the container (`server/container.ts` — confirm via
`graphify explain "container"`). Any new service must be **registered there and injected via the
cradle**, matching the existing `ExecutorDeps`/registration pattern. Do not `new` services inline in
consumers.

## Testing conventions
- **Server unit:** inject stubs at boundaries (provider HTTP/`ProviderFactory`, DB); never mock internal
  domain (`filterRegistry`, `combinationEvaluator`).
- **Server integration:** uses the real test DB — follow the existing `*.integration.test.ts` pattern.
- **Client:** MSW for network; render components, don't mock them; reuse `tests/factories/*`.
- **Existing tests are your regression guards.** A phase's behaviour-preserving steps are proven by the
  suite staying green — keep it green.

## TDD nuance this plan relies on
Some cycles are **refactor-under-guard, not fresh RED** (pure extraction/deletion with no new
behaviour). The tdd skill assumes every step opens with a failing assertion — for these, do **not**
manufacture a contrived test. Use GREEN = "no production change — regression guard" and perform the move
in REFACTOR while the suite stays green. Each `phase-N-prompt.md` flags which cycles these are.

## Scope discipline
Implement **only your phase**. Adjacent debt you spot goes in the phase doc's **Design Debt** table — do
not fix it here. Do not start a later phase's work.

## When done
- `graphify update .`.
- Move the durable implemented pattern to `docs/architecture/` and delete your phase spec from
  `docs/in_progress/` (per the in_progress README).
- Commit per `CLAUDE.md` (durable What/Why/Changes/Testing; end with the `Co-Authored-By: Claude Opus
  4.8` trailer). Stop any dev/test watch process you started (process-hygiene rule).
</content>
