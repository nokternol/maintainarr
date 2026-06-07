# Warden — Query Filter Expansion & Combination Model
## Plan Index

**Context:** Warden is a rule-based automation tool for self-hosted media stacks. The current filter
model (`QueryFilters`) is a flat `Record<string, string | number | boolean>` against a single
provider. This plan expands that model and adds set-algebra query combination, ordered by delivered
user value (highest first).

**Product owner framing:** Saved queries define *named sets of media items*. The automation builder
becomes a *set algebra editor* — combine named sets with UNION, INTERSECT, DIFFERENCE, and
precedence rules. Motivation: "delete movies matching Query A unless they also match Query B"
composed as `A AND NOT B` rather than one monolithic query with negation.

---

## Phase status

| Phase | File | Status | Prerequisite |
|---|---|---|---|
| 0 — Provider metadata inventory | `INVENTORY.md` | **COMPLETE** | — |
| 0b — Surface IDs in ratings response | `QUERIES_phase_0b.md` | **COMPLETE** | Phase 0 |
| 1 — Tier 1 predicate expansion | `QUERIES_phase_1.md` | **COMPLETE** | Phase 0b |
| 2 — Tier 2 enrichment pipeline | `QUERIES_phase_2.md` | **IN PROGRESS** (Session A done) | Phase 1 |
| 2b — `saved_query.mediaType` refactor | `docs/intent/QUERIES_phase2b.md` | **READY** | Phase 2 Session A |
| 3 — Combination model backend | `QUERIES_phase_3.md` | blocked on 2b | Phase 2b |
| 4 — Combination builder UI | `QUERIES_phase_4.md` | blocked on 3 | Phase 3 |

---

## Architecture flags (course corrections required, not just extensions)

| Finding | Affects | Phase | State |
|---|---|---|---|
| `mediaEnrichment` table does not exist — must be designed from scratch | All Tier 2 predicates | 2 | active |
| `saved_query` has no `mediaType` — query/provider mismatch is silent; executor branches on provider.type instead of query type | Schema + executor | 2b | **addressed by Phase 2b** |
| `automation.queryId` nullable FK — system automations use null; user automations still carry it until Phase 3 drops the column | Schema migration | 3 | updated (queryId nullable since Session A) |
| `AutomationExecutor` only dispatches RADARR and SONARR — Jellyfin tasks declared but unimplemented | Executor | 2 | active |
| `Overseerr.searchResult.mediaInfo` typed as `unknown` — all status/ID fields inaccessible | Provider type | 2 | active |
| `useMediaFilters.ts` accumulates one field per predicate — review for parameter-object refactor at Phase 1 end | Client filter state | 1 | active |
| Preview endpoint does not exist — required before Phase 4 UI is meaningful | New API route | 4 | active |
| Tautulli title matching is the current cross-provider join — `INVENTORY.md` documents the ID-based replacement path | Identity graph | 2 | active |
