# Phase 4 prompt — Client query/filter alignment

Invocation: `tdd docs/in_progress/phase-4-prompt.md docs/in_progress/phase-4-client-query-alignment.md`

Read `AGENT_BRIEF.md` first, then the cycle doc and `docs/intent/media-query-engine.md` (the
`MediaQuery`/`MediaItemSet` vocabulary you align the client to). Depends on Phase 1 (engine + honest
`/preview`).

## The seams (verified)
- **Filter view** — `src/hooks/useMediaFilters.ts` (`FilterState`, `buildQuery`, `parseQuery`),
  `src/components/MediaFilterBar/*`, `src/components/QueryRow/index.tsx`.
- **Saved queries / grid** — `src/hooks/useSavedQueries.ts`, `src/hooks/useMovies.ts` /
  `useSeries.ts`.
- **New hook** — `useQueryPreview(savedQueryId)` (SWR) → `GET /saved-queries/:id/preview` (honest after
  Phase 1). Mock with MSW.
- **Mapping** — `FilterState → MediaQuery source` (`{ filterValues, role }`), matching what the saved
  query persists, so client and server speak one vocabulary.

## Scope
- **In:** preview-count hook + its display; the `FilterState → MediaQuery source` mapping; include/exclude
  role parity in `QueryRow`.
- **Out / note in Design Debt:** a **live count for an unsaved (draft) query** needs a preview-by-spec
  server endpoint (engine accepting an inline `MediaQuery`) — small separate server addition, not built
  here.
- Do **not** touch `/search/metadata` — separate verb, re-scoped/retired elsewhere.

## Refactor-under-guard cycle
The grid-parity behaviour is a regression guard (the handler changed in Phase 1; the client contract did
not). Cycles 1–4 are genuine RED.

## Visual pass
After hook/mapping logic is green, run the filter view + per-row preview count + include/exclude through
`impeccable` — **Ladle story first**, per `CLAUDE.md`. Stop the Ladle/dev server when done.

## Done when
Per the spec: the client shows the engine-backed preview count and expresses queries as `MediaQuery`
sources matching the server, so preview and execution agree across the boundary.
</content>
