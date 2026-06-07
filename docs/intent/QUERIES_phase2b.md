# Phase 2b — `saved_query.mediaType` Refactor

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 2 Session A shipped
**Blocks:** Phase 3 (combination model requires typed queries)
**Status:** INTENT — not yet implemented

---

## Why this exists

Phase 1 built a working automation loop. Phase 2 is adding Tier 2 enrichment predicates. During
Phase 2 Session A we discovered that the design has an uncovered assumption: the executor uses
`automation.provider.type` (RADARR or SONARR) to branch the entire execution path — which media
list to fetch, which filter function to apply, which task table to use. But `saved_query` carries
no `mediaType` annotation. The two are implicitly coupled only through the automation that binds
them, with no enforcement in the data layer.

This is not a design mistake — it's an assumption that was correct for Phase 1 (one provider, one
query, one filter function) but that becomes load-bearing as the model evolves. Phase 3's
combination model allows composing multiple queries per automation, which makes the implicit
coupling unworkable: a query must know its own type independently of which automation it's
attached to.

Fixing this now (Phase 2b) is cheaper than fixing it mid-Phase 3 when the migration has more
moving parts.

---

## What changes

### `saved_queries` table — add `mediaType`

```sql
-- migration: ALTER TABLE saved_queries ADD COLUMN mediaType TEXT NOT NULL DEFAULT 'movie'
-- then backfill series queries inferred from their linked automations:
UPDATE saved_queries
SET mediaType = 'series'
WHERE id IN (
  SELECT queryId FROM automations
  WHERE queryId IS NOT NULL
    AND providerId IN (
      SELECT id FROM metadata_provider WHERE type = 'SONARR'
    )
);
```

Orphaned queries (no automation yet) default to `'movie'` — Radarr was the first supported
provider and the safer default for unknown queries.

### `SavedQueryService` — require `mediaType` on create

`SavedQueryService.create()` currently accepts `{ name, filters }`. Extend to
`{ name, filters, mediaType: 'movie' | 'series' }`. The field is required; no default at the
service layer (only at the DB layer for the migration).

### `AutomationService.create()` — enforce compatibility

When creating an automation, validate that `query.mediaType` is compatible with `provider.type`:
- `RADARR` provider requires `mediaType: 'movie'`
- `SONARR` provider requires `mediaType: 'series'`

Throw `ValidationError` if they disagree. This is the enforcement that makes the silent mismatch
impossible going forward.

### `AutomationExecutor` — use `query.mediaType` as the authoritative discriminator

Currently branches on `provider.type`. After this refactor, branch on `automation.query.mediaType`
instead. Both must agree (enforced at creation time), but using the query's own type makes the
executor's logic self-documenting: "this query is a movie query, apply movie filters."

### `AutomationDto` — expose `query.mediaType`

`AutomationDto.query` is `{ id, name, filters }`. Add `mediaType` to this shape so callers can
render the query type without needing to inspect the provider.

---

## Files involved

### Modified files
| File | Action |
|---|---|
| `server/database/schema.ts` | Add `mediaType text NOT NULL default 'movie'` to `savedQueries` |
| `server/database/migrations/00XX_saved_query_media_type.sql` | ALTER + backfill |
| `server/services/savedQueryService.ts` | Require `mediaType` in create; expose in DTO |
| `server/services/automationService.ts` | Validate query/provider compatibility in `create()` |
| `server/services/automationExecutor.ts` | Branch on `query.mediaType` instead of `provider.type` |
| `server/modules/automations/automations.schemas.ts` | `mediaType` field in saved query create schema |

---

## Phase 3 handoff

Once this ships, Phase 3's combination model operates against typed queries. A combination of two
`movie` queries is still a movie automation. A combination of `movie` + `series` queries in the
same automation is a cross-type combination — Phase 3 must decide whether to allow or reject this.
The Phase 3 plan should be updated to reflect that `mediaType` is available on each query source,
and that `automation_query_sources` rows carry an implicit type via the query they reference.

---

## Acceptance criteria

- `saved_queries` table has a `mediaType TEXT NOT NULL` column
- Existing rows are backfilled correctly (SONARR-linked queries → `'series'`, all others → `'movie'`)
- `SavedQueryService.create()` requires `mediaType`
- `AutomationService.create()` throws `ValidationError` when query.mediaType and provider.type disagree
- `AutomationExecutor` branches on `query.mediaType`, not `provider.type`
- All existing tests pass; new tests cover the validation error path
