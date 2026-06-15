# Provider Source Model (target)

**Status:** INTENT (future state, not built). The corrective target for the emergent model documented
in `docs/architecture/provider-roles-and-identity.md`. Sharpens "what is a source" so multi-instance
setups, versions/editions, and per-source tasks have a home, while keeping the door open to media
servers as catalog owners.

## Decision: the catalog is *seeded* by sources; everything else enriches

Some providers **seed** the catalog (define what exists + a canonical id); others **enrich** it.
"Source" is the name for the seeding role. This is the original intention, now made explicit.

**Today the seeding sources are Radarr and Sonarr instances**, and that is the right primary target —
not because media servers don't matter, but because of *what this app is for*:

- The app's value is operating on the gap between **monitored / wanted / requested** and
  **downloaded** (unmonitor what's watched, search for what's missing). Radarr/Sonarr carry
  monitored-but-fileless items; Plex/Jellyfin carry only files-on-disk.
- A media-server-owned catalog literally cannot represent the rows the automations act on, and it
  makes whole filter families trivial (e.g. "Downloaded" is always true).
- The first real users all run Radarr/Sonarr (one runs two Radarr instances: 4k + non-4k).

## "Source" is a provider *instance*, not a provider type

The current `(sourceType, sourceId)` identity key fuses two axes that must be separated:

- **Kind / role** — "owns movies" (radarr-like) vs "owns series" (sonarr-like). Drives normalization,
  content type, and the filter registry.
- **Instance** — *which* configured provider. Drives uniqueness, enrichment keying, and task routing.

**Correction:** identity is keyed by the instance — `(providerId, externalId)` — with kind carried
alongside, and a separate **logical key** (tmdb/tvdb/imdb) for grouping. The 4k + non-4k Radarr case
works the moment instance and type are distinct. Formalizing "source" is not a new concept bolted on;
it is un-fusing one the schema already half-encodes.

## Data vs presentation: many records, one row

The forcing case (two Radarr instances; or one Plex item with editions / quality-optimized versions)
resolves to a deliberate split:

- **In data: one record per concrete version**, so a task can target each independently
  ("search the 4k copy", "delete the mobile-optimized version"). Versions are a real leaf, and they
  occur **within a single source** (Plex editions / quality versions), not only across instances.
- **In presentation: one row per logical title**, deduped by the logical key, so filtering and the
  grid don't clutter with duplicates of the same film.

## The entity model (decided)

Two persisted tables, separating three concepts that were previously fused — record identity, media
match, and grouping:

- **`media_identity` = the group** (the logical title). It *is* what `media_identity` already is — a
  bundle of cross-provider identifiers (`tmdbId`, `tvdbId`, `imdbId`, `tvMazeId`, `plexRatingKey`, …)
  plus its surrogate `id`. It **stops being per-source**: the `(sourceType, sourceId)` coordinate is
  removed (it moves to `media_item`). Enrichment continues to hang off `media_identity`, which is
  correct — playcount/watched is title-level.
- **`media_item` = one record per source copy** (new). Surrogate `id`, `providerId` (the configured
  provider instance — the provider *is* the source, so there is no separate source concept),
  `externalId` (the provider's native id for the item, formerly `sourceId`), and `mediaIdentityId`
  (FK to its group). `kind` is **derived from the provider** (Radarr→movie, Sonarr→show), not stored.

```
media_identity  (group; id-bundle; one logical title)
  └─ media_item  (one per source copy: providerId + externalId)
```

- **Record identity** is the surrogate `id` — never the match key.
- **Media match** (`tmdbId`/`tvdbId`/…) are fallible *attributes*, the resolver's inputs.
- **Grouping** is the stored `media_item.mediaIdentityId` edge — separable from the match, so a wrong
  match is correctable later without mutating source-derived data.

**Versions/editions stay simple.** The common case is one `media_item` per group. A 4k + non-4k pair
(two instances) or Plex editions are just *additional `media_item` rows under the same group* — no
version table. A `version`/`edition` label can be added to `media_item` later only where a source
actually exposes multiples.

## Task targeting (decided)

Tasks stay **instance-bound** — there is **no group-level fan-out**. An automation remains
`(one provider instance, query, task)` via the existing single `automations.providerId` binding; the
executor fetches that provider's items, filters, and acts on the matches, exactly as today. Running the
same query across two instances (4k + non-4k Radarr) is **two automations** — same query, one task per
provider. The duplication is accepted in exchange for keeping targeting unchanged and explicit.

Consequently the group model (`media_identity`) is **not** a task-routing mechanism. It exists for:

- **Display dedup** in the *browse/library* view (the whole-catalog view across all providers shows one
  row per title, not one per instance). An automation's own preview is already single-instance, so it
  needs no dedup.
- **Enrichment**, which hangs off the group; a per-instance automation reaches title-level facts
  (watched, requested) by joining `media_item → media_identity → media_enrichment`.
- **Correctable matching**, per the auto-resolver above.

This also collapses the filter-classification concern: there is no "instance" filter, because the
automation's bound provider *is* the instance. Item attributes come from the provider; group-level
enrichment predicates are joined in via the item's `media_identity`.

## Logical grouping & the auto-resolver (decided)

Grouping is **auto-resolved only** for now — no manual-correction layer yet. The surrogate-id /
match-key separation above is precisely what lets a manual override be added later without a rewrite;
it is explicitly deferred, not designed-in now.

The resolver's rule, KISS:

- **Key the group on the per-kind native identifier** — `tmdbId` for movies, `tvdbId` for series —
  treated as a *best guess*. `media_identity` carries a `UNIQUE` constraint on the primary id per kind.
- **Find-or-create by primary id, then attach** the `media_item` and merge its *other* identifiers into
  the group.
- **Never auto-merge two existing groups** (no transitive bridging by a shared secondary id — that is
  the dangerous over-merge). An item with no primary id gets its **own** group via the fallback chain
  (`imdbId` → `title`+`year`).
- Duplicate groups that result from fallback/missing ids are **left for the future manual layer** to
  reconcile — that is exactly what it is for.

## Forward compatibility: media servers as sources, later

Because "source" is a *role*, not a hardcoded pair, Plex/Jellyfin can graduate from enricher to source
later — `runForPlex` changing from *stamping* existing rows to *inserting* them — enabling an
*arr-free deployment without re-architecting. Ship *arr-instances-as-sources now; keep this reachable.

## Decided in this pass (was open)

- **Record shape** — two tables (`media_identity` group / `media_item` per-source), versions as extra
  `media_item` rows, no version table. See "The entity model".
- **Logical grouping key & merge rule** — native primary id per kind, find-or-create, no auto-merge.
  See "Logical grouping & the auto-resolver".
- **Manual correction** — explicitly deferred; the model supports it (surrogate id vs match), but it is
  not built now.
- **Task targeting** — instance-bound, no fan-out; multi-instance = N automations. Automation→provider
  binding unchanged. See "Task targeting".

## Still open / the next modeling work

1. **Display grouping source.** The browse path reads *live* provider data (`radarr.getMovies()`), not
   the DB. Library-view dedup can group live items by their own primary id without waiting on the
   resolver, while the persisted `media_item`/`media_identity` spine backs enrichment/correction.
   Confirm the read path groups live items by primary id rather than joining the
   (eventually-consistent) tables.
2. **Migration.** Drop `(sourceType, sourceId)` from `media_identity`; add `media_item` with
   `(providerId, externalId)` UNIQUE + `mediaIdentityId`; rework `IdentityResolutionJob` to upsert
   `media_item` and resolve groups; `enrichmentMerge` and `_sourceIds` follow. `media_enrichment`'s FK
   to `media_identity` is unchanged.
3. **Other multi-instance types.** SEERR/Overseerr and future types may also be multi-instance; the
   instance-not-type correction should be uniform, not Radarr/Sonarr-special.
4. **Surrogate id type.** Whether new ids are time-ordered UUIDs or keep the existing autoincrement
   integer (`media_identity` uses integer today). Minor and reversible; noted so it is a choice.

## Relationship to earlier decisions

- This retro-justifies leaving `media:changed` payload empty (see
  `docs/intent/domain-event-bus-hardening.md`): the correct segmentation vocabulary is *kind* and
  *source/version*, neither of which exists cleanly yet. A discriminator should wait for this model.
- It subsumes the "provider privileging" open question previously noted in the event-bus hardening
  doc — that note now points here.
