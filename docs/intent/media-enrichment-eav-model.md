# Media enrichment: `itemId, fieldId, value` persistence shape

**Status:** INTENT (resolved design, not yet built). Reached via a grilling pass during the
`plex-added-date` phase (docs/in_progress/plex-added-date.md, now shipped) after that phase's own
change — adding `plexAddedAt` — served as the concrete evidence for the problem this doc addresses.

## Problem

`server/database/schema.ts`'s `mediaEnrichment` table is one row per media identity, one nullable typed
column per `EnrichmentFields` key (`playCount`, `lastWatchedAt`, `overseerrRequestStatus`,
`overseerrHasIssue`, `tmdbStatus`, `plexAddedAt` — 6 as of this doc, was 5 before this phase). Every new
field requires touching all of: `schema.ts`, a migration, `EnrichmentFields`
(`mediaFieldProvider.ts`), `activeFieldSet.ts`'s `fieldsByProviderType`, `movie.ts`/`show.ts`'s
`Pick<EnrichmentFields, …>` union, `enrichmentMerge.ts`'s copy-through line, `filterRegistry.ts`'s rule,
and `enrichmentJob.ts`'s write-side `values` object — at least 7 hand-maintained touch points, none
compiler-enforced to stay in sync with each other.

**This is not hypothetical.** Adding `plexAddedAt` in the phase that produced this doc missed the 7th
touch point (`enrichmentJob.ts`'s write `values` object) on the first pass. Every test passed because the
test suite inserts enrichment rows directly, bypassing `EnrichmentJob`. The bug — `plexAddedAt` would
never actually be persisted by the real scheduled job — was only caught by manually reading the write
path during this design discussion, not by any automated check. Fixed in the same session
(`server/__tests__/modules/media/enrichmentJob.test.ts`'s "persists a resolved Plex-added ISO value").

`docs/architecture/media-providers.md`'s companion `INVENTORY.md` (repo root, generated 2026-06-05)
catalogs roughly 80–90 candidate fields across Radarr, Sonarr, Tautulli, Plex, Jellyfin, Overseerr, TMDB,
OMDB, and TVMaze that aren't yet fetched or filterable. Today's 6 `EnrichmentFields` keys are the early
edge of that backlog, not close to a ceiling — the per-field touch-point cost compounds every time one of
those 80–90 gets built.

**Explicitly not the motivation:** raw storage bytes. This app runs on libsql (`@libsql/client`,
`drizzle-orm/libsql`), a SQLite-family engine whose variable-length row format stores a `NULL` column as
roughly one header byte, not the column's full width — the wide table's "wasted space on unconfigured
providers" is not a real cost at any plausible catalog scale. The actual driver is correctness and change
cost: how many places a field addition/rename/removal touches, and whether the schema can express "this
field doesn't exist" for a removed field without a data migration touching every row.

## Resolved shape

```
enrichment_field
  id       INTEGER PRIMARY KEY
  key      TEXT UNIQUE NOT NULL   -- 'plexAddedAt', 'playCount', … — seeded via migration

media_enrichment
  mediaIdentityId  INTEGER NOT NULL REFERENCES media_identity(id) ON DELETE CASCADE
  fieldId          INTEGER NOT NULL REFERENCES enrichment_field(id) ON DELETE CASCADE
  value            TEXT NOT NULL   -- JSON-encoded: number | string | boolean | array
  UNIQUE(mediaIdentityId, fieldId)
```

- **`value` is JSON-encoded `TEXT`, not typed columns.** Filter predicates (`filterRegistry.ts`) never
  read the database again after the DAL reconstructs the typed `NormalizedMovie`/`NormalizedShow` — they
  run entirely in-memory against the pivoted object, same as today. So `value`'s SQL type only needs to
  round-trip cleanly through the DAL mapper, not carry query-time type fidelity. One JSON column handles
  numbers, strings, booleans, and arrays (`watchlistUserIds`, `docs/intent/per-consumer-watchlist-enrichment.md`)
  uniformly — no type-discriminator column, no `valueInt`/`valueText`/`valueJson` split.
- **`fieldId` is a numeric FK to `enrichment_field`, not the literal string key.** Confirmed this app
  enforces SQLite foreign keys at runtime (`@libsql/client`'s `migrate()` explicitly restores
  `PRAGMA foreign_keys=on` after every migration batch — `node_modules/@libsql/client/lib-cjs/sqlite3.js`),
  so `ON DELETE CASCADE` is real, not decorative. This buys: renaming a field is a one-row edit to
  `enrichment_field` instead of a bulk `UPDATE` across every fact row; removing a field cascade-deletes
  its fact rows automatically instead of requiring a matching cleanup migration; and the DB rejects a
  `fieldId` that doesn't correspond to a currently-declared field, which today's hand-maintained
  `EnrichmentFields` union cannot enforce on its own. This is a deliberate departure from this schema's
  own precedent (`metadataProviders.type` is plain indexed `TEXT` for an analogous small closed enum) —
  justified here because `media_enrichment` row count scales with `item × active field` (tens of
  thousands+), where `metadataProviders` scales with configured instance count (a handful), so the
  repeated-text-per-row cost and the rename/removal blast radius are both real in a way they aren't for
  provider type.
- **Domain shape is unchanged.** `EnrichmentFields`, `filterRegistry.ts`'s predicates,
  `enrichmentMerge.ts`'s public contract (`mergeEnrichment(db, items)`), and `NormalizedMovie`/
  `NormalizedShow` stay exactly as they are. Only the DAL query+mapper behind `enrichmentMerge.ts` and the
  write path in `enrichmentJob.ts` change — from straight-line column reads/writes to a row-set
  pivot/unpivot keyed by `enrichment_field.key ↔ EnrichmentFields` key.
- **Write lifecycle is unchanged in kind, not just similar.** `EnrichmentJob.run()` already does a full
  resolve-and-replace on every pass — today via `UPDATE ... SET` with `?? null` for anything unresolved.
  Under this shape the same full replace becomes: write one row per field present in the resolved item,
  and any field not present in this pass's resolved output has no row (whether because it was never
  written or because a previous pass's row for it is removed as part of the same replace). No separate
  "staleness" or "prune schedule" question — it is the same per-pass operation, row-shaped instead of
  column-shaped.

## What still needs deciding before this becomes a phase plan

- **Migration path for existing wide-table data.** Today's `media_enrichment` rows (6 columns, one row
  per identity) need to unpivot into `(mediaIdentityId, fieldId, value)` rows as part of the schema
  migration — not just a fresh empty EAV table. Not designed yet.
- **Whether `activeFieldSet.ts`'s `fieldsByProviderType` and `movie.ts`/`show.ts`'s
  `Pick<EnrichmentFields, …>` unions collapse into something derived from `enrichment_field`, or stay as
  separate hand-authored declarations.** These are two of the touch points this doc's own motivation
  criticizes; whether an `enrichment_field` table naturally subsumes them or is orthogonal to them wasn't
  resolved in the grilling pass that produced this doc.
- **The DAL mapper itself** — where it lives (a new module, or absorbed into `enrichmentMerge.ts` and
  `enrichmentJob.ts` in place), and whether the pivot/unpivot is one query with an in-memory group-by or
  something SQL-side (e.g. per-field-per-row `json_group_object` if libsql's JSON1 extension is
  available) — not investigated.
