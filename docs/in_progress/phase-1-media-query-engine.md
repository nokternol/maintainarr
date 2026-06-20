# Phase 1 — MediaQueryEngine (collection-resolution heal)

**Status:** IN PROGRESS — **Phase 1** of the System-Roles & MediaQueryEngine Heal (see `README.md`).
TDD (backend). **Depends on:** —. Realises `docs/intent/media-query-engine.md`.

## Observable value

One owner resolves "what does this query match." Each behaviour is assertable from outside the engine:

- **Evaluate:** a `MediaQuery` (one include source, a provider's items) evaluates to the matched
  `MediaItemSet` — asserted by the ids returned.
- **Combine:** an include source plus an exclude source evaluates to the set difference.
- **Honest preview:** `GET /saved-queries/:id/preview` returns `{ count }` equal to the engine's result
  for that query — replacing the hardcoded `{ count: 0 }`.
- **Convergence:** the executor and `listMovies`/`listSeries` resolve through the engine; their existing
  behaviour is unchanged (regression-guarded), and the duplicated filter loops are gone.

## Problem

`applyFilters` (executor, private) and `filterViaRegistry` (`media.handler`) are the **same filter loop,
copy-pasted**; `evaluateCombination` (`server/services/combinationEvaluator.ts`) exists but is wired only
into the executor; `/preview` resolves nothing (`return { count: 0 }`). Three owners of one truth, free
to disagree (preview already does — it always says 0).

## Design

- **`MediaQuery`** — `{ provider: MetadataProvider; contentType: 'movie' | 'show'; sources:
  { filterValues: FilterValueEntry[]; role: 'include' | 'exclude' }[] }`. A saved query is a
  single-source include `MediaQuery`; the browse view is the same with URL-derived `filterValues`.
- **`MediaQueryEngine.evaluate(query): Promise<MediaItemSet>`** — fetches the bound provider's items
  (`ProviderFactory`), normalizes + merges enrichment, applies the predicate registry per source, and
  combines via `evaluateCombination`. `MediaItemSet` = the matched normalized items (callers project ids
  or paginate). Depends on `ProviderFactory` + `filterRegistry` + `combinationEvaluator`.
- **Owner, not helper.** The executor keeps only the **action** half (build the query, `evaluate`,
  project ids, `task.run`); `/preview` and `media.handler` become callers.

## Mocking

| Mock target | Boundary / Internal | Justification |
|---|---|---|
| `ProviderFactory` / provider HTTP | Boundary | external `*arr` API; inject a stub returning fixed items |
| `mergeEnrichment` / DB | Boundary | I/O; the engine's contract is matching+combination, not enrichment correctness |
| `filterRegistry` (`getFilterDef`) | Internal | the rule set under test; never mocked |
| `combinationEvaluator` | Internal | the combination contract; exercised, not mocked |

## TDD cycles

1. **Tracer — evaluate one include source.** RED: `engine.evaluate({ provider, contentType:'movie',
   sources:[{ filterValues:[<one predicate>], role:'include' }] })` returns the ids of the items that
   satisfy the predicate (provider stubbed with two items, one matching). Engine API does not exist →
   assertion fails. GREEN: minimal `evaluate` — fetch via injected factory, `matchItems` one source,
   return matches. REFACTOR: extract `matchItems` (the shared filter loop) as the engine's primitive.
2. **Combine include + exclude.** RED: a query with an include source and an exclude source returns
   include-minus-exclude. GREEN: feed per-source results into `evaluateCombination`. REFACTOR.
3. **Empty filter values → all items.** RED: a source with `filterValues: []` matches every item.
   GREEN: short-circuit empty (parity with current `applyFilters`/`filterViaRegistry`). REFACTOR.
4. **Unknown content type → empty set.** RED: `contentType` with no owner resolves to an empty
   `MediaItemSet` (parity with the executor's `return 0`). GREEN: guard. REFACTOR.
5. **Executor resolves via the engine.** Regression guard — existing `automationExecutor` +
   combination tests must stay green. GREEN: no behaviour change; replace the private `applyFilters` +
   inline combination in `executeWithSources` with `engine.evaluate`, keeping `task.run`. REFACTOR:
   delete the dead private helper.
6. **Honest preview count.** RED: `GET /saved-queries/:id/preview` for a seeded query returns
   `{ count: <engine result length> }`, not `0` (integration; provider stubbed). GREEN: build a
   single-source include `MediaQuery` from the saved query + the active provider of its `contentType`,
   `evaluate`, return the length. REFACTOR.
7. **Browse resolves via the engine.** Regression guard — existing browse filter integration tests
   stay green. GREEN: `media.handler` builds a `MediaQuery` from its `paramMap`-derived `filterValues`
   and calls `evaluate`; pagination/sort/facets stay in the handler. REFACTOR: delete
   `filterViaRegistry`.

## Gates

- `yarn test` (vitest) — existing executor, combination, saved-query-preview, and browse filter tests
  must stay green.
- `yarn typecheck:server`, `yarn lint`.

## Done when

`MediaQueryEngine.evaluate` is the single resolver; `/preview` returns a real count proven equal to the
engine's result; the executor and browse handler call the engine; `applyFilters` and `filterViaRegistry`
are deleted. `/search/metadata` is untouched (separate verb).
</content>
