# Phase 4 — Combination Builder UI

**Repo:** `/home/nokternol/repos/sandbox`  
**Prerequisite:** Phase 3 backend shipped; API accepts `querySources` array  
**Status:** BLOCKED on Phase 3

---

## What this phase is and why

Replaces the "pick one query" step in the automation builder with a set-algebra editor where
the user can add multiple saved queries and assign each a role of Include or Exclude (unless).

The backend (Phase 3) is already done before this phase starts. This phase is UI-only.

---

## Context window strategy

This phase is medium size — one component replacement plus a new API endpoint. Split into:

**Session A:** Steps 4.1–4.3 (component + role selector + preview endpoint)  
**Session B:** Steps 4.4–4.5 (preview display + validation + full test pass)

Before starting, read the existing `AutomationBuilder` component to understand the current
step structure. Use a haiku subagent for that read to avoid loading the full component into
the main context.

Test runner: `yarn vitest run --project client`  
Server test: `yarn vitest run --project server`

---

## Files involved

| File | Action |
|---|---|
| `src/pages/automations/index.tsx` | Locate `AutomationBuilder` usage — understand current step flow |
| `src/components/AutomationBuilder/` | Replace single-query picker with `QuerySourceList` |
| `server/modules/savedQueries/savedQueries.handler.ts` | Add `preview` handler |
| `server/modules/savedQueries/savedQueries.routes.ts` | Register `GET /:id/preview` route |
| `src/hooks/useAutomations.ts` | Update mutation to send `querySources` instead of `queryId` |

---

## Current step flow (read before editing)

The automation builder has 3 steps: pick a query → pick a task → pick a schedule.  
Step 1 currently renders a single saved-query selector.  
This phase replaces Step 1 with the combination editor.

---

## Step 4.1 — `QuerySourceList` component (replaces single query picker)

The component manages a list of `{ queryId, role, sortOrder }` entries.

```
┌────────────────────────────────────────────────────────────┐
│  RUN ON                                                    │
│  ┌──────────────────────────────────┐  [+ Add query]      │
│  │ ● Movies with cleanup tag         │                     │
│  │   role: [Include ▼]               │  [×]               │
│  └──────────────────────────────────┘                     │
│  ┌──────────────────────────────────┐                     │
│  │ ● Protected watchlist items       │                     │
│  │   role: [Exclude (unless) ▼]      │  [×]               │
│  └──────────────────────────────────┘                     │
│                                                            │
│  ~42 matched · 14 excluded · 28 to act on                 │
└────────────────────────────────────────────────────────────┘
```

Props:
```ts
interface QuerySourceListProps {
  sources: { queryId: number; role: 'include' | 'exclude'; sortOrder: number }[];
  savedQueries: { id: number; name: string }[];
  onChange: (sources: QuerySourceListProps['sources']) => void;
}
```

Role selector labels:
- `include` → **"Include"** — "items matching this query are candidates"
- `exclude` → **"Exclude (unless)"** — "remove these from the candidate set"

If the user adds more than 2 exclude queries, show a nudge below the list:
> "Complex exclusion rules can be hard to reason about — consider simplifying."

Do not block. No boolean tree UI in v1.

---

## Step 4.2 — Role selector dropdown

Use the same dropdown pattern as existing selectors in the automation builder. The options are
fixed: Include and Exclude (unless). No "other" option. Selecting a role updates the source
entry in the list.

---

## Step 4.3 — Preview endpoint

New server route: `GET /api/saved-queries/:id/preview` → `{ count: number }`

This re-evaluates the saved query against the current provider data and returns the item count.
It does NOT need to apply combination logic — it previews a single query in isolation.

The handler re-uses the existing `SavedQueryService` to load the filters, then applies them
against the cached Radarr/Sonarr data (same cache used by `listMovies`/`listSeries`).

```ts
// Rough shape:
const filters = await savedQueryService.getFilters(id);
const { movies } = await getMovies();   // from media handler cache
const filtered = applyMovieFilters(movies, filters);
return { count: filtered.length };
```

For the preview display in the UI, call this endpoint for each source in the list and show:
- Include sources: `{count} matched`
- Exclude sources: `{count} excluded`
- Net count below the list: `{includeTotal - excludeTotal} to act on` (approximate — actual
  set difference may be smaller due to overlap)

Note: The net count is an approximation because it doesn't account for items that appear in
both an include and an exclude set. Mark it with a `~` prefix (`~28 to act on`).

---

## Step 4.4 — Preview display

Wire the preview endpoint into `QuerySourceList`. Fetch counts when:
- The source list changes (add/remove/role change)
- On first render

Use SWR or the existing hook pattern for data fetching. Show a loading skeleton while fetching.

---

## Step 4.5 — Validation

Before allowing the user to proceed from Step 1 to Step 2:
- At least one source with role `include` must be present
- The include source must have a `queryId` selected (not a blank picker)

Show an inline error if the user tries to proceed without meeting these criteria.

---

## Hook update (`useAutomations.ts`)

Update the automation create/update mutation to send:
```ts
{ querySources: [{ queryId, role, sortOrder }, ...] }
```
instead of `{ queryId }`.

Keep backward compatibility: if the API returns an automation with the old `queryId` shape
(during a transition period), convert it to a single-include `querySources` list for display.

---

## Acceptance criteria

- User can add multiple saved queries with Include / Exclude (unless) roles
- Preview counts appear for each source and update when the source list changes
- Net count is displayed with `~` prefix
- At least one Include source is required to proceed; inline validation error if missing
- Existing automations (now using `automation_query_sources`) display correctly in the updated builder
- No full boolean tree UI (no parentheses, no AND/OR operators between individual rows)
- All client tests pass; no regressions in the automations page
