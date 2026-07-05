# MediaQueryEngine — the single owner of "what does this query match"

**Status:** IMPLEMENTED. [`server/services/mediaQueryEngine.ts`](ref:path:server/services/mediaQueryEngine.ts). Realised the model formerly in
`docs/intent/media-query-engine.md`.

## The three concepts

The set of media a query defines is not a stored entity — it is the *result* of evaluating a query
specification against live source data.

- **`MediaQuery`** — the specification: a **bound provider instance**, a `contentType`
  (`'movie' | 'show'`), and one-or-more **sources**, each `{ filterValues, role: 'include' | 'exclude' }`.
  A saved query is a single-source include `MediaQuery`; the browse view is the same with URL-derived
  `filterValues`.
- **`MediaQueryEngine.evaluate(query): Promise<MediaItemSet>`** — the owner. Fetches the bound provider's
  items, normalizes them, merges DB enrichment, applies the predicate registry per source (`matchItems`),
  and combines include/exclude across sources (`evaluateCombination`).
- **`MediaItemSet`** — the transient result: the matched normalized items (`NormalizedMovie |
  NormalizedShow`). Callers project ids to act, or paginate/sort to display. No table.

## Why a bound provider *instance*, not provider settings

`MediaQuery.provider` is an already-constructed provider, not `MetadataProvider` settings + a factory.
This keeps provider construction to **exactly one `ProviderFactory.create` per execution**: the executor
builds the provider once, hands the instance to `evaluate`, and reuses the *same* instance for
`task.run`. The engine never news a provider — each caller owns that decision:

| Caller | Builds the provider via | Uses the result for |
|---|---|---|
| `AutomationExecutor.executeWithSources` | `providerFactory.create(providerSettings)` | project ids → `task.run` |
| `GET /saved-queries/:id/preview` | active provider of the query's `contentType` (single-active invariant) | `{ count: set.length }` |
| `media.handler` browse (`listMovies`/`listSeries`) | a thin adapter over the cached library (`{ getMovies: async () => all }`) | id set → sort/paginate the raw library |

The browse adapter lets the handler keep its cached multi-provider fetch (and `yearRange`/error
aggregation) while the engine owns normalize → enrich → match → combine.

## Internals

- **`matchItems(items, filterValues, contentType)`** — the shared filter primitive: the subset
  satisfying every predicate under `getFilterDef`. An empty `filterValues` matches all items (`[].every`
  is vacuously true). Exported for direct reuse.
- **`combine`** (private) — maps each source through `matchItems`, projects source ids, runs
  `evaluateCombination` (include union minus exclude), and returns the surviving normalized items.
- Unknown `contentType` resolves to an empty `MediaItemSet`.
- Depends on [`filterRegistry`](ref:label:filterRegistry) (rule set) and `combinationEvaluator` (combination contract) — both
  internal domain, never mocked. DB enrichment (`mergeEnrichment`) runs when a `db` is injected.

## Registration

`mediaQueryEngine` is registered in the awilix container ([`server/container.ts`](ref:path:server/container.ts)) and injected into the
executor, the saved-query preview handler, and the media browse handler. The executor falls back to
`new MediaQueryEngine({ db })` when no engine is injected (unit tests).

## Convergence achieved

Before this engine, "which items match these filter values" was owned by three sites that disagreed:
the executor's private `applyFilters`, the browse handler's duplicated `filterViaRegistry`, and a
`/preview` that returned a hardcoded `{ count: 0 }`. Both duplicated loops are deleted; `/preview`
returns the engine's real count. All three sites now resolve through `evaluate` and cannot diverge.

## Sequencing note

`MediaItemSet`'s element is the provider's normalized item today, under the single-active-provider
invariant. When the `media_item` migration (`docs/intent/provider-source-model.md`) lands, the element
becomes `media_item` and preview/browse gain a provider-instance axis — and the engine is the single
place that change lands.
