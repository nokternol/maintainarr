# Phase 4 — Client query/filter alignment

**Status:** IN PROGRESS — **Phase 4** of the System-Roles & MediaQueryEngine Heal (see `README.md`).
TDD (client hooks) + `impeccable` (filter view visual). **Depends on:** Phase 1 (engine + honest
`/preview`).

## Observable value

The client speaks the engine's vocabulary, so what the UI shows equals what an automation will act on:

- **Honest count surfaced:** a preview hook returns the engine-backed `{ count }` for a saved query, and
  the builder/query UI displays it — no more implicit `0`.
- **One query vocabulary:** the client maps its filter state to the `MediaQuery` source shape
  (`filterValues` + `role`) that the server persists and the engine evaluates — asserted by the mapping.
- **Role parity:** a query row's include/exclude maps to `MediaQuery` `source.role`.
- **Grid parity:** the browse grid reflects engine-resolved results (regression-guarded; the handler
  changed in Phase 1, the client contract did not).

## Problem

The filter view (`useMediaFilters`, `MediaFilterBar`, `QueryRow`) and the saved-query preview grew their
own shapes. With the engine now the single resolver and `/preview` honest, the client must (a) show the
real count and (b) express "a query" as the same `MediaQuery` sources the server stores — otherwise the
preview a user sees and the set an automation acts on can still diverge in the client layer.

## Scope

- **In:** the preview-count hook + its display; the `FilterState → MediaQuery source` mapping;
  include/exclude role parity.
- **Out / noted:** a **live count for an unsaved (draft) query** needs a preview-by-spec server endpoint
  (the engine accepting an inline `MediaQuery`). It is a small, separate server addition — flagged here,
  not built in this phase. `/search/metadata` (the metadata title-search view) stays as-is, to be
  re-scoped or retired separately.

## Mocking

| Mock target | Boundary / Internal | Justification |
|---|---|---|
| `/saved-queries/:id/preview` `fetch` (MSW) | Boundary | network; drive count from fixed responses |
| `/api/media/*` `fetch` (MSW) | Boundary | grid data; existing pattern |
| `useMediaFilters` mapping | Internal | the mapping under test; exercised, not mocked |

## TDD cycles

1. **Tracer — preview hook returns the count.** RED: `useQueryPreview(savedQueryId)` (MSW-mocked
   honest `/preview`) exposes `{ count }`. Hook absent → fails. GREEN: SWR fetch. REFACTOR.
2. **Builder displays the saved-source count.** RED: a query row bound to a saved query renders its
   preview count. GREEN: wire the hook into the row. REFACTOR.
3. **Filter state maps to the `MediaQuery` source shape.** RED: a populated `FilterState` maps to a
   `filterValues` array matching what the saved query persists (same keys/values the server expects).
   GREEN: a mapping function. REFACTOR: share the shape type with the server contract.
4. **Include/exclude role parity.** RED: a `QueryRow` set to "exclude" maps to `source.role: 'exclude'`.
   GREEN: thread the role. REFACTOR.

## Visual pass (impeccable, not TDD)

After hook/mapping logic is green, run the filter view and preview-count display through `impeccable`
(Ladle story first per `CLAUDE.md`): the `MediaFilterBar`, the per-row count, and include/exclude.

## Gates

- `yarn test` (vitest) — `useMediaFilters`, builder, and media-grid tests green; new hook tests green.
- `yarn typecheck:client`, `yarn lint`.

## Done when

The client shows the engine-backed preview count and expresses queries as `MediaQuery` sources matching
the server, so preview and execution agree across the boundary. Draft (unsaved) live-count is documented
as the next, optional server addition.
</content>
