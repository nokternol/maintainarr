# Phase 1 prompt — MediaQueryEngine

Invocation: `tdd docs/in_progress/phase-1-prompt.md docs/in_progress/phase-1-media-query-engine.md`

Read `AGENT_BRIEF.md` first, then `phase-1-media-query-engine.md` (your cycles) and
`docs/intent/media-query-engine.md` (the model). This file is only the phase-specific seams and traps.

## The seams (verified)
- **Complete resolver to extract** — `server/services/automationExecutor.ts`:
  - private `applyFilters(items, filterValues, contentType)` (~L39–49) — the filter loop.
  - `executeWithSources(...)` (~L145–195): fetch provider items → `normalizeRadarrMovie`/
    `normalizeSonarrSeries` → `mergeEnrichment(db, normalized, 'RADARR'|'SONARR', m => m._sourceIds.*)`
    → per-source `applyFilters` → `evaluateCombination` → `finalIds` → `task.run`. **Everything before
    `task.run` moves into the engine; `task.run` stays.**
- `server/services/combinationEvaluator.ts` — `evaluateCombination(QueryResult[]) → ItemId[]`,
  `QueryResult = { role:'include'|'exclude'; items: ItemId[] }`. **Reuse; don't reimplement.**
- `server/utils/filterRegistry.ts` — `getFilterDef(key, contentType).apply(item, value)`. Internal,
  never mock.
- Duplicated loop: `filterViaRegistry` in `server/modules/media/media.handler.ts` (~L150–168) — same
  loop behind a `paramMap`. Cycle 7 deletes it.
- Lying stub: `server/modules/savedQueries/savedQueries.handler.ts` (~L52–64) `return { count: 0 }`.
  Cycle 6 makes it real.
- `savedQueryService.getById(id)` → `.contentType`, `.filterValues`. `ProviderFactory.create(settings,
  log)` builds the provider; `getMovies()`/`getSeries()` return raw items.

## Refactor-under-guard cycles (no fresh RED)
**Cycle 5** (executor delegates) and **Cycle 7** (browse delegates) are behaviour-preserving — existing
executor / browse-filter tests are the assertion. Cycles 1–4 and 6 are genuine RED.

## Traps
- `sources` = multiple **saved queries** combined include/exclude against **one bound provider
  instance** — not multiple instances. Don't generalise.
- Do **not** build `media_item` or touch identity/migration. `MediaItemSet` today = matched normalized
  items; project ids via `_sourceIds.radarr`/`sonarr` as the executor does. The migration lands here
  later.
- `/preview` is resolvable today only via the single-active-provider-per-type invariant — pick the
  active provider of the saved query's `contentType`.
- Do **not** touch `server/modules/search/*` (`/search/metadata`) — different verb, out of scope.

## Done when
Per the spec's "Done when": one engine resolves all three sites; `/preview` returns a real count proven
equal to the engine; `applyFilters` and `filterViaRegistry` deleted; suite + typecheck + lint green.
</content>
