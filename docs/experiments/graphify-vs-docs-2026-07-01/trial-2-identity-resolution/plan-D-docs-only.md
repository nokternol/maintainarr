# Plan D

(Method D worker — context-gathering method withheld for blind grading)

## Implementation Plan

### Context

`media_identity` (`server/database/schema.ts:216-235`) already has an `imdbId text` column with an index (`idx_media_identity_imdb`) — it was added for Radarr/Sonarr owner rows (which already populate `imdbId` from their own APIs) but the Plex-side linking logic never uses it. **No schema migration is needed.**

The linking logic lives entirely in `IdentityResolutionJob.runForPlex` (`server/jobs/identityResolutionJob.ts:29-54`). It iterates each Plex item's `guids`, regex-matches `tmdb://<id>` and `thetvdb://<id>`, and calls a shared helper `setPlexRatingKey(column, id, ratingKey)` that does `UPDATE media_identity SET plexRatingKey = ? WHERE <column> = <id>`. Plex's IMDb guid form is `imdb://<ttID>` (e.g. `imdb://tt1234567`) — a string, not a parsed integer, which is why it can't reuse the existing helper signature unchanged (that helper's `column` param is typed as `tmdbId | tvdbId`, both integer columns, and its `id` param is `number`).

### Changes, in order

1. **`server/jobs/identityResolutionJob.ts`** — the only production file that needs to change.
   - Add a third guid match: `const imdbMatch = guid.id.match(/^imdb:\/\/(tt\d+)$/);` (capture the full `tt...` string, not just digits — `imdbId` is stored as text, e.g. `'tt0000001'` in existing test fixtures/schema).
   - Extend `setPlexRatingKey` to accept the `imdbId` (text) column too, or add a lightweight overload/second helper, since its current signature is typed to integer columns and takes `id: number`. Cleanest approach: generalize the private helper to be column-type-agnostic:
     ```ts
     private async setPlexRatingKey(
       column: typeof mediaIdentity.tmdbId | typeof mediaIdentity.tvdbId | typeof mediaIdentity.imdbId,
       id: number | string,
       ratingKey: string
     ): Promise<number>
     ```
     `eq(column, id)` from drizzle-orm doesn't care which concrete column/value type at runtime, so this is a safe generalization; TypeScript may need a small assertion or a widened `eq` call since `column`'s type is now a union — verify this compiles cleanly (drizzle's `eq` overloads may not resolve for a union of differently-typed columns; if so, drop to two thin private methods or accept a broader column type and cast at the call site).
   - In the `for (const guid of item.guids ?? [])` loop, add an `else if (imdbMatch)` branch calling `setPlexRatingKey(mediaIdentity.imdbId, imdbMatch[1], item.ratingKey)`.
   - Decide guid precedence/behavior when a single Plex item has multiple guids (e.g. both `tmdb://` and `imdb://` in the same `guids` array, which Plex does sometimes send for "hybrid" agents). Current code already loops over *all* guids per item and fires an update for each match independently. Adding imdb keeps that same "fan out per matching guid" behavior: if an item has both a tmdb and an imdb guid, it will update up to two different identity rows — this mirrors current tmdb/tvdb dual-match behavior, so no behavior change in kind, just in coverage. Worth confirming this is intentional/pre-existing so it isn't accidentally "fixed" as part of this task.

2. **`server/__tests__/services/identityResolutionJob.test.ts`** — add coverage, following the existing two `runForPlex` tests exactly:
   - A test seeding a `RADARR` identity row with `imdbId: 'tt0000001'` and a Plex item with `guids: [{ id: 'imdb://tt0000001' }]`, asserting `plexRatingKey` gets stamped.
   - A "counts rows actually changed" case mirroring the existing tmdb one, to lock in the return-value semantics for imdb matches too.
   - Optionally a mixed-guid case (item with `imdb://` only, no tmdb/tvdb) since that's the actual gap being closed — this is the realistic "Plex only gives us an IMDb id" scenario from the brief, so it deserves its own explicit test rather than only exercising it as a third branch alongside tmdb/tvdb tests.

### Order of work

1. Confirm the `eq()`/column-union typing question by trial-compiling the generalized `setPlexRatingKey` (or fall back to a duplicate small private method) — this is the only real unknown, do it first since it shapes the diff.
2. Implement the regex + branch + (possibly refactored) helper in `identityResolutionJob.ts`.
3. Add/extend tests in `identityResolutionJob.test.ts`.
4. Run the existing test file to confirm both old and new cases pass.

### Things I'm not fully sure about / would verify before starting

- **Exact Plex IMDb guid format.** Inferring `imdb://tt1234567` from Plex/agent convention; there is no existing parsing of this format anywhere else in this codebase to cross-check against. Worth a quick sanity check against a real Plex `guids` payload before locking the regex, particularly whether the `tt` prefix is always present and whether numeric-only or zero-padding variants ever appear.
- **Column-type union through `eq()`/drizzle-orm.** Whether `eq(column, id)` type-checks when `column`'s type is a union of an integer column and a text column, and `id` is `number | string`. If it doesn't infer cleanly, the fallback is two near-identical private setters, which is a slightly uglier but zero-risk fallback.
- **Multi-guid-per-item interaction with `imdbId`'s uniqueness expectations.** `imdbId` has an index but not a `UNIQUE` constraint (only `(sourceType, sourceId)` is unique) — same as `tmdbId`/`tvdbId`. If for any reason two identity rows shared the same `imdbId`, the `UPDATE ... WHERE imdbId = ?` would silently stamp the same Plex `ratingKey` onto multiple rows. This is a pre-existing risk pattern shared with tmdb/tvdb, not something new introduced by this change, but worth flagging since it's exactly the kind of "no crash, just wrong" failure the brief asks about.

### What could silently break if done slightly wrong

- **Regex too loose or too strict.** If the imdb regex only matches digits (dropping the `tt` prefix) it will never match real Plex guids (silent no-op, looks "done" in code review but never actually links anything) — the existing schema/tests store `imdbId` *with* the `tt` prefix, so the captured group must preserve it, unlike the tmdb/tvdb regexes which capture only digits into a `Number.parseInt`.
- **Reusing `Number.parseInt` on the imdb match by copy-paste.** Since `tmdbMatch`/`tvdbMatch` both feed `Number.parseInt(match[1], 10)` into an integer column, it would be an easy but wrong copy-paste to do the same for imdb — `imdbId` is a text column and `parseInt('tt0000001', 10)` returns `NaN`, which would silently update rows with `WHERE imdbId = NaN` (matches nothing, no error, just never links).
- **`setPlexRatingKey`'s return-value contract (`rowsAffected`) must still work identically for the text column** — no reason it wouldn't, but worth confirming `result.rowsAffected` behaves the same for a text-column predicate under drizzle's SQLite driver as it does for the existing integer-column predicates, since the "counts rows actually changed" test explicitly depends on this.
- **Silent scope creep should be avoided**: this task is narrowly about `runForPlex`'s linking, not about `enrichmentJob.ts`'s existing (separate, already-working) `imdbId` handling for enrichment lookup keys — don't touch that file, it already handles imdb correctly for its own purpose and isn't part of the gap described.

---

## Exploration log (in order, as self-reported by the worker)

1. List repo root + read root instructions file — got directory listing, project layout, docs convention.
2. List docs, docs/architecture, docs/intent, docs/in_progress — enumerated doc files to find the identity-model doc.
3. Read: docs/architecture/provider-roles-and-identity.md — as-built identity model description: media_identity keyed by (sourceType, sourceId), runForPlex only stamps plexRatingKey by tmdbId/tvdbId match, never inserts.
4. Grep: "tvdb|tmdb" filtered for plex-related files — pattern too narrow, non-productive, no output.
5. Find: identityResolutionJob* — located the job file and its test file.
6. Read: server/jobs/identityResolutionJob.ts — full current implementation of runForPlex, setPlexRatingKey, runForSeries, runForMovies.
7. Grep: mediaIdentity/media_identity in server/database/schema.ts — located schema definition line numbers.
8. List: server/database/migrations — confirmed most recent migration, inferred imdbId was part of an early media_identity migration.
9. Read: server/database/schema.ts (identity/enrichment section) — confirmed imdbId text column already exists with an index.
10. Grep: getAllItems/ratingKey/guids/imdb in plexProvider.ts — found PlexMediaItem.guids shape, no imdb-specific handling yet.
11. Read: server/providers/plexProvider.ts — full provider: getAllItems, getLibraries, getLibraryContents, enrich() (separate from identity resolution).
12. Grep: imdb across providers/jobs/services — surveyed all other imdb usage in the codebase to confirm none of those need changes.
13. Read: server/jobs/enrichment/mappers.ts — confirmed mapPlexItems (a different, unrelated Plex mapping function for view-count enrichment) doesn't touch guids/imdb.
14. Grep: runForPlex/imdb/tmdb/tvdb in identityResolutionJob.test.ts — found existing test structure/fixtures for runForPlex.
15. Read: server/jobs/enrichmentJob.ts — confirmed this file's imdbId usage is for a separate concern (building a synthetic MediaItem for enrichment key-matching), not part of the gap.
16. Grep: imdb://|thetvdb://|tmdb://|guid.id|guids across server excluding tests — confirmed no existing imdb guid-format parsing anywhere else in the codebase to cross-check the regex against.
17. Grep: runForPlex/IdentityResolutionJob across server excluding the job file itself — found callers: systemTaskRunner.ts and identityJobFactory.ts, confirming no other call sites need changes.
18. Grep: imdb in docs/intent, docs/architecture, docs/in_progress — confirmed no existing intent doc already plans this specific change.
19. Read: server/jobs/identityJobFactory.ts — confirmed factory just wires providers in, no imdb-specific change needed there.
20. Read: server/__tests__/services/identityResolutionJob.test.ts (first ~100 lines) — full test file header/fixtures, confirming makeMovie/makeSeries already carry imdbId fixtures usable as reference values for new Plex tests.

**Total exploration tool calls (self-reported): 20.**

**Self-reported confidence every file needing change was found: High.** The identity-linking logic is fully contained in one file (identityResolutionJob.ts) with one clear entry point (runForPlex); traced all its callers (factory, task runner — neither needs changes), confirmed the schema already supports imdbId (no migration needed), confirmed no other code parses Plex imdb:// guids that would need to move in lockstep, and confirmed the one test file that needs new cases. The only genuine uncertainty is a micro-level implementation detail (exact regex format, drizzle typing for the generalized helper), not "did I miss a file."

## Raw metrics (measured, not self-reported)
- Tool uses (harness-counted): 22
- Wall-clock duration: ~130s
- Tokens consumed: ~38,300
