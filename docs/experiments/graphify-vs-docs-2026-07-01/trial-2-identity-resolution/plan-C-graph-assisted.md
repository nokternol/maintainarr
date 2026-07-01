# Plan C

(Method C worker — context-gathering method withheld for blind grading)

## Implementation Plan

### Background / root cause

`IdentityResolutionJob.runForPlex()` (`server/jobs/identityResolutionJob.ts`) is the sole place that stamps a Plex `ratingKey` onto an existing `media_identity` row. It iterates each Plex item's `guids` and only recognizes two GUID shapes:

```ts
const tmdbMatch = guid.id.match(/^tmdb:\/\/(\d+)$/);
const tvdbMatch = guid.id.match(/^thetvdb:\/\/(\d+)$/);
```

If neither matches (e.g. Plex only supplied `imdb://tt1234567`), the item is silently skipped — no row is ever updated, no error, no log. This is the entire bug. The `media_identity` table already has an `imdbId` (text) column with an index (`idx_media_identity_imdb`), populated by Radarr/Sonarr on ingest, so the join target already exists — this is purely a matching-source gap in the Plex GUID parser, not a schema gap.

`setPlexRatingKey`'s helper signature is currently narrowed to only the two integer columns:

```ts
private async setPlexRatingKey(
  column: typeof mediaIdentity.tmdbId | typeof mediaIdentity.tvdbId,
  id: number,
  ratingKey: string
): Promise<number>
```

`imdbId` is a `text` column holding string ids like `"tt0000001"`, so this signature must be generalized to accept a text column + string id as well as the existing integer column + number id, rather than adding a third near-duplicate branch.

### Files to touch, in order

1. **`server/jobs/identityResolutionJob.ts`** (primary/only functional change)
   - Add an `imdbMatch` regex branch alongside `tmdbMatch`/`tvdbMatch` in `runForPlex()`. Plex's IMDb GUID form is `imdb://ttNNNNNNN` (mirrors the `tmdb://` / `thetvdb://` pattern already handled) — match and pass the full `tt...` string (do not parse to int; column is `text`).
   - Generalize `setPlexRatingKey`'s type signature to `typeof mediaIdentity.tmdbId | typeof mediaIdentity.tvdbId | typeof mediaIdentity.imdbId` and its `id` parameter to `number | string`, so `eq(column, id)` still type-checks for all three columns without a third copy-pasted private method.
   - No changes needed to `runForMovies`/`runForSeries` — they already write `imdbId` from Radarr/Sonarr on ingest; this task only adds the Plex-side *read/match* of that same value.

2. **`server/__tests__/services/identityResolutionJob.test.ts`**
   - Add a test mirroring the existing tmdb test but with `guids: [{ id: 'imdb://tt0000001' }]` matching a seeded row's `imdbId`.
   - Add/extend a "counts rows changed" case with a mixed tmdb+imdb+tvdb items list to confirm no regression in existing branches and that an unmatched imdb id still returns 0.
   - Consider a case where a Plex item carries *both* a tmdb and imdb GUID for the same title (real Plex items often do) — verify behavior is sane (e.g. both attempts run; whichever matches a row wins; no double-count corruption) since the current loop already permits multiple guid matches per item and iterates `changed +=` per guid, so this should already work correctly but is worth an explicit regression test given it's the highest-risk edge case here.

3. **`docs/architecture/provider-roles-and-identity.md`** (doc correction, not optional — it currently asserts incorrect/soon-to-be-incorrect fact)
   - Line ~79 currently states: "`runForPlex` never inserts — it only *stamps* `plexRatingKey` onto rows that already match by `tmdbId`/`tvdbId`". Update to include `imdbId` in that list once implemented, per this repo's own convention (architecture docs must track code changes, not drift stale).

### Order of operations

1. Write/extend the failing test(s) in `identityResolutionJob.test.ts` first (repo appears to follow TDD conventions per its own instructions).
2. Implement the regex branch + generalized `setPlexRatingKey` signature in `identityResolutionJob.ts`.
3. Run the full job test suite (`identityResolutionJob.test.ts`, `identityJobFactory.test.ts`) — factory itself needs no change, but its test should still pass unmodified as a regression check.
4. Update `docs/architecture/provider-roles-and-identity.md`.

### Things I'd verify before starting (not fully confirmed from static exploration)

- **Exact Plex GUID prefix for IMDb.** Inferred `imdb://ttNNNNNNN` by analogy with the two existing prefixes, but found zero occurrences of `imdb://` anywhere in this repo (tests, fixtures, or code) to confirm it against this codebase's own assumptions. This is the single biggest unknown — if Plex actually emits a different scheme (some Plex agents use legacy-agent GUIDs, or bare `ttNNNNNNN` without a prefix in older items), the regex needs adjusting accordingly.
- **IMDb id format stored on `media_identity.imdbId`.** Radarr/Sonarr fixtures use `tt0000001` (with `tt` prefix, no further transformation) — treating the Plex-parsed id the same way; confirm this is also what real Radarr/Sonarr responses store.

### What could silently break if done slightly wrong

- **Storing digits-only instead of `tt`-prefixed string** (i.e. copying the `Number.parseInt` pattern used for tmdb/tvdb by mistake) would produce imdb ids that never match the `"tt1234567"` values Radarr/Sonarr write — the code would run without error, `rowsAffected` would just always be 0 for imdb matches, and nobody would notice until someone specifically audited why IMDb-only Plex items still aren't linking. This is exactly the class of bug the task is trying to fix, just reintroduced silently.
- **Regex too loose/tight.** If the IMDb GUID actually includes extra segments Plex sometimes appends, an over-tight anchored regex would silently match nothing for those items (same silent-no-link failure as today, just for a subset).
- **Multiple GUIDs per item ambiguity.** Since the loop already does `changed += await this.setPlexRatingKey(...)` per guid independently (not `break` after first match), a Plex item with both `tmdb://` and `imdb://` guids where the two ids point to *different* `media_identity` rows would silently stamp the *same* `plexRatingKey` onto two different rows. This isn't new behavior introduced by this change — it already exists for tmdb/tvdb combos — but adding a third guid type increases the chance of it happening. Not in scope to fix, but worth flagging since it's an easy thing to make worse without realizing it.
- **Doc drift.** If the `provider-roles-and-identity.md` update is skipped, the "AS-BUILT" doc becomes actively wrong (claims tmdb/tvdb only) rather than just stale, which this repo's own conventions treat as a defect, not cosmetic — worth calling out since it's the kind of miss that produces no test failure at all.

### Critical Files for Implementation
- server/jobs/identityResolutionJob.ts
- server/__tests__/services/identityResolutionJob.test.ts
- docs/architecture/provider-roles-and-identity.md
- server/database/schema.ts (read-only reference — confirms imdbId column/index already exist, no migration needed)
- server/jobs/identityJobFactory.ts (read-only reference — confirms no wiring changes needed)

---

## Exploration log (in order, as self-reported by the worker)

1. Read repo root instructions file — confirmed docs conventions and repo tooling rules.
2. Graph-tool query: "how does linking a Plex library item to a canonical identity record work" — irrelevant results (matched an unrelated design-token "canonical" node); graph's fuzzy match picked the wrong "canonical" node.
3. Graph-tool query: "Plex library item TMDB TVDB link identity" + graph-tool "explain": "identity linking" — surfaced DB schema/migration nodes (tmdb_id/tvdb_id/imdb_id columns) but no direct code entry point; the explain call found nothing for that literal phrase.
4. Grep: "tvdb_id|tmdbId|tvdbId" across server (excluding migrations/tests) — found candidate files, most promisingly `identityResolutionJob.ts`.
5. Graph-tool "explain": "identityResolutionJob" — pinpointed the class, its methods (`runForPlex`, `runForMovies`, `runForSeries`, `setPlexRatingKey`), and its callers (`identityJobFactory.ts`, its test file) — the most useful single tool call in this exploration.
6. Read: server/jobs/identityResolutionJob.ts — read the full file; found the exact bug and the narrow `setPlexRatingKey` column type.
7. Grep (with context): mediaIdentity in server/database/schema.ts — confirmed `imdbId` column (text) already exists with an index; no migration needed.
8. Find: located the test files and factory by filename.
9. Read: server/__tests__/services/identityResolutionJob.test.ts — read existing test patterns/fixtures (confirmed `imdbId` format `tt0000001` from Radarr/Sonarr fixtures).
10. Find + grep: located plexProvider.ts and its test.
11. Read: server/jobs/identityJobFactory.ts — confirmed factory just wires deps through; no change needed there.
12. Grep + Read: server/providers/plexProvider.ts — confirmed `PlexMediaItem.guids` is untyped/raw pass-through; no existing imdb handling anywhere in the provider.
13. Grep: guid/tmdb/thetvdb/imdb in server/jobs/enrichment/mappers.ts — no output; confirmed enrichment mapper doesn't duplicate guid-parsing logic.
14. Grep: "tmdb://|thetvdb://|guid\.id\.match" across the whole repo — confirmed the regex parsing exists in exactly one file plus its tests; no duplicate logic elsewhere to update.
15. Read: server/jobs/identityJobFactory.ts (revisited via schema/provider grep) — confirmed `imdbId?: string` fields on provider types and `text('imdbId')` in schema, establishing the string format.
16. Graph-tool query: "Plex guid formats tmdb thetvdb imdb agent" plus grep for "imdb" in docs/ — surfaced the relevant architecture docs describing the identity model and enricher role.
17. Read: docs/architecture/provider-roles-and-identity.md — found the as-built doc's explicit (soon-to-be-stale) claim that `runForPlex` matches only by tmdbId/tvdbId; identified this as a required doc update.
18. Read (partial): docs/architecture/media-enricher-role.md — confirmed Plex's *enrichment* path matches by ratingKey, not by tmdb/tvdb/imdb directly — confirming the imdb fix is scoped entirely to the identity-resolution job.
19. Find: searched for any dedicated guid-parsing utility module — none exists, confirming no second place houses this logic.
20. Grep: imdb/imdbId in identityJobFactory.test.ts — no output; confirmed factory's test doesn't need updates.

**Total exploration tool calls (self-reported): 20 (18-20 depending on how setup reads are counted).**

**Self-reported confidence every file needing change was found: High.** Verified via three independent negative-evidence checks: (a) grep for the regex patterns across the whole repo found only the one source file + tests, (b) the enrichment mapper for Plex matches by ratingKey not by tmdb/tvdb/imdb (architecturally isolated from this bug), and (c) no dedicated "guid parser" module exists elsewhere to duplicate. The only residual uncertainty is the exact IMDb GUID string format Plex emits in production, which appears nowhere in this repo's fixtures/tests/code — a real-world verification, not a "did I miss a file" risk.

## Raw metrics (measured, not self-reported)
- Tool uses (harness-counted): 21
- Wall-clock duration: ~152s
- Tokens consumed: ~43,900
