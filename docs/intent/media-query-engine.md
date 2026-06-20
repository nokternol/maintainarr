# MediaQueryEngine — one owner for "what does this query match" (target)

**Status:** INTENT (target, not built). Defines the single owner of collection-resolution and the
**minimal, ownership-based steps to heal a live divergence in code**. This is a cohesion prerequisite:
the provider/source migration (`docs/intent/provider-source-model.md`) should wait until the engine
below exists, because it gives that migration a single, stable seam to land `media_item` into.

## There is no "Collection" entity — there is a query, an engine, and a result set

The set of media a saved query defines is **not** a stored thing. It is the *result* of evaluating a
query specification against live source data. Three concepts, named:

- **`MediaQuery`** — the specification. A bound **provider instance** + `contentType` + one-or-more
  **query sources**, each being `{ filterValues, role: 'include' | 'exclude' }`. A *saved query* is a
  persisted single-source `MediaQuery`; the *filter view's* "query under construction" is an in-flight
  one. Same shape, same engine.
- **`MediaQueryEngine.evaluate(query: MediaQuery): MediaItemSet`** — the owner. It fetches the bound
  provider's items, normalizes + enriches them, applies the predicate registry per source
  (`matchItems`), and combines include/exclude across sources (`evaluateCombination`). It depends on
  `ProviderFactory` + `filterRegistry` + `combinationEvaluator` and owns producing the result.
- **`MediaItemSet`** — the transient result: the set of matched normalized media items (callers project
  ids from it to act, or paginate/sort it to display). Its element aligns with the future `media_item`
  (`provider-source-model.md`); today it is the provider's normalized item. No table, ever.

This is a **query engine** in the established sense — execute a query spec against data via a rule
set + a combination plan, return rows — which is why "engine" and not "resolver" (a resolver implies a
bare lookup, with no rule evaluation).

## The divergence being healed (as-built)

"Which items match these filter values" is currently owned by **three sites that cannot agree**:

| Site | What it does today | Defect |
|---|---|---|
| `automationExecutor.executeWithSources` | `applyFilters` (private) + `evaluateCombination` → ids → `task.run` | the only complete resolver, but **private** to the executor |
| `GET /saved-queries/:id/preview` | `return { count: 0 }` | a **stub that lies** — owns nothing |
| `media.handler.filterViaRegistry` | duplicated `items.filter(getFilterDef.apply)` | single-source, **no combination**; can't reproduce execution |

`filterViaRegistry` and `applyFilters` are the *same filter loop, copy-pasted*. The fix is the ownership
rule: **pick one owner, rewrite the others to call it.** The owner is `MediaQueryEngine`.

`GET /search/metadata` (the metadata title-search view) is **out of scope** — it is a different verb
(per-system title lookup, originally built to visualize available data), not collection resolution. It
shares no truth with the engine and is left alone (to be re-scoped or retired separately).

## Minimal heal — ordered, each step shippable

1. **Extract the match primitive (pure, zero behaviour change).** New
   `server/services/mediaQueryEngine.ts` exporting `matchItems(items, filterValues, contentType)` —
   lifted verbatim from the executor's private `applyFilters`. Existing executor tests cover it once
   step 2 lands.
2. **Executor delegates.** Replace the executor's private `applyFilters` with `matchItems`. Pure
   refactor; executor + combination tests prove no behaviour change. Ownership has moved off the
   executor.
3. **Promote to `MediaQueryEngine.evaluate(MediaQuery)`.** Lift the resolution half of
   `executeWithSources` (fetch → normalize → enrich → per-source `matchItems` → `evaluateCombination`)
   into the engine, returning a `MediaItemSet`. The executor keeps only the **action** half: build the
   `MediaQuery` from the automation, call `evaluate`, project ids, `task.run`. The engine now owns
   `ProviderFactory` + registry + combination.
4. **Preview calls the engine.** Rewrite `/saved-queries/:id/preview` to build a single-source
   `MediaQuery` (saved query's `filterValues`, `role: 'include'`, active provider of its `contentType`)
   and return `{ count: set.length }`. Deletes the `{ count: 0 }` lie; preview now equals execution by
   construction. Add an integration test asserting the count matches a seeded query.
5. **Filter view calls the engine.** Rewrite `media.handler` to build a `MediaQuery` from the browse
   URL params (its existing `paramMap` → `filterValues`, `role: 'include'`) and call `evaluate`,
   deleting `filterViaRegistry`. Pagination/sort/facets stay in the handler, applied to the returned
   `MediaItemSet`. Multi-source combination becomes available to the view for free.

Steps 1–2 are the safe, test-backed foundation (land and commit first). 3 consolidates; 4–5 route the
remaining consumers. After step 5 the three sites share one owner and cannot diverge.

## Sequencing against the provider/source migration

The engine heal comes **first** and is independent of the `media_item` migration:

- Today the engine returns ids the way the executor already does (`_sourceIds.radarr`/`sonarr`), under
  the single-active-provider invariant — which is also what makes `/preview` resolvable now (exactly one
  active provider per `contentType`).
- When `media_item` lands, `MediaItemSet`'s element *becomes* `media_item`, and preview/browse gain a
  provider-**instance** axis (multi-instance makes "which instance does this saved query preview
  against" a real choice). The engine is the single place that change lands — which is the cohesion the
  migration needs and the reason it waits for this.
</content>
