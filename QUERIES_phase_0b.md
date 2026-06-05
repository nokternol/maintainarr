# Phase 0b — Surface discovered IDs in the ratings response

**Repo:** `/home/nokternol/repos/sandbox`  
**Prerequisite:** Phase 0 complete — `INVENTORY.md` exists  
**Blocks:** Phase 2 identity graph  
**Status:** READY TO EXECUTE

---

## What this phase is and why it exists

The ratings fan-out (`GET /api/providers/ratings?title=X`) already calls TMDB, OMDB, and TVMaze
in parallel. Each of those calls resolves the cross-provider identity graph as a side effect of
the title search — it finds a matching record, extracts an internal ID, fetches details using
that ID, then throws the ID away before returning.

Title is the only input available at this stage. That is the correct bootstrap — once a title
lookup resolves a `tmdbId`, `imdbId`, `tvdbId`, or `tvMazeId`, those IDs never need title
matching again. The goal of this phase is to stop discarding the IDs that are already being
found, surface them in the `AggregatedRatings` response, and display them in the RatingsPanel.
This makes the panel a live graph probe: click any media item and see which cross-provider IDs
were resolved, and whether they agree across providers (a disagreement means the title matched
the wrong record on one of them).

**No new API calls. No schema changes. No new endpoints.**  
All IDs come from responses already being made.

---

## Context window and cost strategy

This phase touches 5 server files and 1 UI file across 4 TDD cycles plus a UI step. The risk
of hitting a context limit mid-task is real. Mitigation:

1. **Read source files via a cheap haiku subagent upfront.** Spawn one haiku agent at the start
   to read all 5 server source files and the 3 existing test files, and return only the
   interface definitions and test pattern (not full file contents). This costs one subagent call
   instead of loading ~600 lines into the main context.

2. **The interface shapes are given verbatim in this document.** Do not re-read provider files
   to understand the current interface — the "current state" section below is authoritative.
   Only read a file when you are about to edit it.

3. **Commit after step 4 (all server tests green) before starting step 5 (UI).** If context
   is exhausted mid-UI step, the server work is committed and recoverable. A fresh session
   can read the committed diff to understand what was done and continue from step 5.

4. **Run tests after each GREEN step.** A passing test suite is the checkpoint. If context
   is lost between steps, the next session can run `yarn vitest run --project server` and
   read which tests exist to know exactly where things stopped.

5. **Step 5 (RatingsPanel UI) can be delegated to a haiku subagent** with the exact interface
   shape provided in the prompt. It is mechanical — add an `ids` section to the panel using
   the existing display patterns. No reasoning required.

---

## Files involved

### Server (TDD cycles 1–4)

| File | Action |
|---|---|
| `server/providers/tmdbProvider.ts` | Extend `TmdbRating` interface; populate IDs in `getRatings()` |
| `server/providers/omdbProvider.ts` | Extend `OmdbRating` interface; populate `imdbId` in `parseRatings()` |
| `server/providers/tvmazeProvider.ts` | Extend `TvMazeRating` interface; populate IDs in `getRatings()` |
| `server/utils/ratingsAggregation.ts` | Extend `AggregatedRatings`; populate `ids` + cross-validate in `aggregateRatings()` |
| `server/__tests__/providers/tmdbProvider.test.ts` | Extend with ID assertions |
| `server/__tests__/providers/omdbProvider.test.ts` | Extend with `imdbId` assertion |
| `server/__tests__/providers/tvmazeProvider.test.ts` | Extend with ID assertions |
| `server/__tests__/utils/ratingsAggregation.test.ts` | Extend with `ids` block assertions (create if missing) |

### Client (step 5)

| File | Action |
|---|---|
| `src/components/RatingsPanel/index.tsx` | Add collapsible `ids` section to panel display |
| `src/components/RatingsPanel/__tests__/RatingsPanel.test.tsx` | Add test for IDs section rendering |

---

## Current state (read this, do not re-read the source files)

### `TmdbRating` — current interface (in `tmdbProvider.ts`)
```ts
export interface TmdbRating {
  source: 'tmdb';
  movieRating?: number;
  movieVotes?: number;
  tvRating?: number;
  tvVotes?: number;
  popularity?: number;
  found: boolean;
}
```

### `TmdbProvider.getRatings()` — current logic (in `tmdbProvider.ts`)
```
search(title) → picks bestMatch (has bestMatch.id = tmdbId, bestMatch.media_type)
if movie: getMovieDetails(bestMatch.id) → details.vote_average, details.vote_count,
          details.popularity, details.imdb_id   ← imdb_id DISCARDED
if tv:    getTvDetails(bestMatch.id) → details.vote_average, details.vote_count,
          details.popularity
returns TmdbRating with scores only — bestMatch.id and imdb_id never included
```

### `OmdbRating` — current interface (in `omdbProvider.ts`)
```ts
export interface OmdbRating {
  source: 'omdb';
  imdbRating?: number;
  imdbVotes?: number;
  rottenTomatoesRating?: number;
  metacriticRating?: number;
  found: boolean;
  awardWinner?: boolean;
  oscarWinner?: boolean;
  director?: string;
  actors?: string;
  language?: string;
  boxOffice?: number;
}
```

### `OmdbProvider.parseRatings()` — what it has access to
```
data: OmdbResponse has data.imdbID (e.g. "tt1375666") at the top level.
parseRatings() reads data.imdbRating, data.imdbVotes, data.Ratings, data.Awards,
data.Director, data.Actors, data.Language, data.BoxOffice.
data.imdbID is never read.   ← DISCARDED
```

### `TvMazeRating` — current interface (in `tvmazeProvider.ts`)
```ts
export interface TvMazeRating {
  source: 'tvmaze';
  rating?: number;
  found: boolean;
}
```

### `TvMazeProvider.getRatings()` — current logic (in `tvmazeProvider.ts`)
```
search(title) → picks bestMatch: TvMazeShow
bestMatch has:
  bestMatch.id          (tvMazeId)    ← DISCARDED
  bestMatch.externals.thetvdb         ← DISCARDED (tvdbId — links to Sonarr)
  bestMatch.externals.imdb            ← DISCARDED (imdbId — links to OMDB)
  bestMatch.rating.average            ← returned
```

### `AggregatedRatings` — current interface (in `ratingsAggregation.ts`)
```ts
export interface AggregatedRatings {
  title: string;
  year?: number;
  tmdb?: TmdbRating;
  omdb?: OmdbRating;
  tvmaze?: TvMazeRating;
  summary: {
    averageRating?: number;
    totalSources: number;
    foundSources: number;
  };
}
```

---

## Pre-flight: read test patterns via haiku subagent

Before any RED step, spawn **one haiku subagent** to read the existing test files and return
the MSW mock patterns and assertion style used. The subagent should read:
- `server/__tests__/providers/tmdbProvider.test.ts`
- `server/__tests__/providers/omdbProvider.test.ts`
- `server/__tests__/providers/tvmazeProvider.test.ts`

And return: the import structure, how MSW handlers are registered, how the provider is
instantiated, and the assertion style for the `getRatings()` tests. Do not return the full
file — just enough to write new tests in the same pattern.

Do NOT spawn this subagent with the `worktree` isolation option — the test files exist in the
main working tree and the subagent only reads them.

Test runner: `yarn vitest run --project server`  
Single file: `yarn vitest run --project server server/__tests__/providers/tmdbProvider.test.ts`

---

## TDD cycles

### Step 1 — `TmdbRating` includes `tmdbId`, `imdbId`, `mediaType`

**RED:** In `server/__tests__/providers/tmdbProvider.test.ts`, add a test to the existing
`getRatings` describe block that asserts:
- When a movie title is found, the returned rating includes `tmdbId` (a number), `imdbId`
  (a string starting with "tt"), and `mediaType: 'movie'`
- When a TV title is found, the returned rating includes `tmdbId` and `mediaType: 'tv'`
  (no `imdbId` — TV details don't return `imdb_id` at the base endpoint)

Use the existing MSW mock pattern from the test file. The movie mock for `getMovieDetails`
should include `imdb_id: 'tt1375666'` in its response fixture.

Run: `yarn vitest run --project server server/__tests__/providers/tmdbProvider.test.ts`  
Confirm the new tests FAIL at the assertion line (not at a type or compile error).

**GREEN:** In `server/providers/tmdbProvider.ts`:

1. Extend `TmdbRating`:
```ts
export interface TmdbRating {
  source: 'tmdb';
  tmdbId?: number;
  imdbId?: string;
  mediaType?: 'movie' | 'tv';
  movieRating?: number;
  movieVotes?: number;
  tvRating?: number;
  tvVotes?: number;
  popularity?: number;
  found: boolean;
}
```

2. In `getRatings()`, include the IDs in the return values:
```ts
// movie branch:
return {
  source: 'tmdb',
  tmdbId: bestMatch.id,
  imdbId: details.imdb_id || undefined,
  mediaType: 'movie',
  movieRating: details.vote_average,
  movieVotes: details.vote_count,
  popularity: details.popularity,
  found: true,
};

// tv branch:
return {
  source: 'tmdb',
  tmdbId: bestMatch.id,
  mediaType: 'tv',
  tvRating: details.vote_average,
  tvVotes: details.vote_count,
  popularity: details.popularity,
  found: true,
};
```

Run tests — confirm GREEN.

**REFACTOR:** Check `getRatings()` for duplication. The `found: false` early return paths
are fine. No structural change likely needed — examine and state conclusion.

---

### Step 2 — `OmdbRating` includes `imdbId`

**RED:** In `server/__tests__/providers/omdbProvider.test.ts`, add an assertion to the
existing successful-fetch test that `result.imdbId` equals the `imdbID` value in the mock
response fixture (e.g. `'tt1375666'`). Confirm the mock fixture already has `imdbID` set;
if not, add it.

Run: `yarn vitest run --project server server/__tests__/providers/omdbProvider.test.ts`  
Confirm FAIL.

**GREEN:** In `server/providers/omdbProvider.ts`:

1. Extend `OmdbRating`:
```ts
export interface OmdbRating {
  source: 'omdb';
  imdbId?: string;       // ← add this
  imdbRating?: number;
  // ... rest unchanged
}
```

2. In `parseRatings()`, add at the top of the result construction:
```ts
if (data.imdbID && data.imdbID !== 'N/A') {
  result.imdbId = data.imdbID;
}
```

Run tests — confirm GREEN.

**REFACTOR:** Examine `parseRatings()` — it already guards all other fields with
`isNaOrEmpty`. Apply the same helper for consistency if not already done.

---

### Step 3 — `TvMazeRating` includes `tvMazeId`, `tvdbId`, `imdbId`

**RED:** In `server/__tests__/providers/tvmazeProvider.test.ts`, add assertions that when a
show is found, the result includes:
- `tvMazeId`: a number (the show's TVMaze ID)
- `tvdbId`: the value from `externals.thetvdb` (number or null)
- `imdbId`: the value from `externals.imdb` (string or null)

Ensure the mock `TvMazeShow` fixture has `externals: { thetvdb: 81189, imdb: 'tt0903747', tvrage: null }`.

Run: `yarn vitest run --project server server/__tests__/providers/tvmazeProvider.test.ts`  
Confirm FAIL.

**GREEN:** In `server/providers/tvmazeProvider.ts`:

1. Extend `TvMazeRating`:
```ts
export interface TvMazeRating {
  source: 'tvmaze';
  tvMazeId?: number;
  tvdbId?: number | null;
  imdbId?: string | null;
  rating?: number;
  found: boolean;
}
```

2. In `getRatings()`, include IDs in the return:
```ts
return {
  source: 'tvmaze',
  tvMazeId: bestMatch.id,
  tvdbId: bestMatch.externals.thetvdb,
  imdbId: bestMatch.externals.imdb,
  rating: bestMatch.rating.average,
  found: true,
};
```

Also update the `found: false` path for the no-rating case — it still has a match, so
include the IDs even when `rating.average` is null:
```ts
// When bestMatch exists but has no rating:
return {
  source: 'tvmaze',
  tvMazeId: bestMatch.id,
  tvdbId: bestMatch.externals.thetvdb,
  imdbId: bestMatch.externals.imdb,
  found: false,
};
```

Run tests — confirm GREEN.

**REFACTOR:** The `getRatings()` method now has two return paths with IDs. Extract ID
extraction to a one-liner if duplication is felt — but only if it reduces noise.

---

### Step 4 — `AggregatedRatings` includes `ids` block with cross-validation

**RED:** In `server/__tests__/utils/ratingsAggregation.test.ts` (create if it does not exist
— check with `ls server/__tests__/utils/`):

Add tests for `aggregateRatings()` asserting:
- When TMDB returns `tmdbId: 123` and `imdbId: 'tt0111161'`, result has `ids.tmdbId: 123` and
  `ids.imdbId: 'tt0111161'`
- When OMDB also returns `imdbId: 'tt0111161'` (agreement), `ids.imdbId` is `'tt0111161'`
  and no warning is triggered
- When TMDB returns `imdbId: 'tt0111161'` but OMDB returns `imdbId: 'tt9999999'`
  (disagreement), `ids.imdbId` takes TMDB's value and a `console.warn` is called (spy on it)
- When TVMaze returns `tvMazeId: 456`, `tvdbId: 81189`, result has those values in `ids`

Run: `yarn vitest run --project server server/__tests__/utils/ratingsAggregation.test.ts`  
Confirm FAIL.

**GREEN:** In `server/utils/ratingsAggregation.ts`:

1. Extend `AggregatedRatings`:
```ts
export interface AggregatedRatings {
  title: string;
  year?: number;
  ids: {
    tmdbId?: number;
    imdbId?: string;
    tvdbId?: number | null;
    tvMazeId?: number;
  };
  tmdb?: TmdbRating;
  omdb?: OmdbRating;
  tvmaze?: TvMazeRating;
  summary: {
    averageRating?: number;
    totalSources: number;
    foundSources: number;
  };
}
```

2. In `aggregateRatings()`, build `ids` with cross-validation:
```ts
// Cross-validate imdbId
const tmdbImdbId = tmdb?.found ? tmdb.imdbId : undefined;
const omdbImdbId = omdb?.found ? omdb.imdbId : undefined;
if (tmdbImdbId && omdbImdbId && tmdbImdbId !== omdbImdbId) {
  console.warn(
    `[ratings] imdbId mismatch for "${title}": TMDB=${tmdbImdbId} OMDB=${omdbImdbId} — title match may be ambiguous`
  );
}

const result: AggregatedRatings = {
  title,
  year,
  ids: {
    tmdbId: tmdb?.found ? tmdb.tmdbId : undefined,
    imdbId: tmdbImdbId ?? omdbImdbId,
    tvdbId: tvmaze?.found || tvmaze?.tvdbId !== undefined ? tvmaze?.tvdbId : undefined,
    tvMazeId: tvmaze?.found ? tvmaze.tvMazeId : undefined,
  },
  // ... rest unchanged
};
```

Run: `yarn vitest run --project server`  
Confirm ALL server tests GREEN (not just ratingsAggregation — a full suite run verifies no regressions).

**REFACTOR:** `aggregateRatings()` now has the cross-validation logic inline. If it grows,
extract `resolveImdbId(tmdb, omdb)` — but only if the inline version reads poorly.

**COMMIT** after this step. Message: `feat: surface cross-provider IDs in ratings response`.
All server changes are now durable. Context can be reset safely — the UI step below is
independent.

---

### Step 5 — RatingsPanel displays the resolved IDs

**Delegate to a haiku subagent.** The subagent should receive this exact brief:

> Read `src/components/RatingsPanel/index.tsx` and `src/components/RatingsPanel/__tests__/RatingsPanel.test.tsx`.
>
> The `AggregatedRatings` type now has an `ids` field:
> ```ts
> ids: {
>   tmdbId?: number;
>   imdbId?: string;
>   tvdbId?: number | null;
>   tvMazeId?: number;
> }
> ```
> The `useRatings` hook returns this type. The ratings object is available as `data` in the panel.
>
> Add a compact "Identity" section at the bottom of the panel content area (below the existing
> `RatingsDisplay`). It should:
> - Only render when at least one ID is present
> - Show each present ID on one line: label + monospace value (e.g. "TMDB  12345", "IMDb  tt0111161")
> - Use the same muted text style as the rest of the panel secondary content
> - Not be collapsible in v1 — just a static list
>
> Add a test in the existing test file that:
> - Mocks `useRatings` to return data with `ids: { tmdbId: 123, imdbId: 'tt0111161' }`
> - Asserts both IDs appear in the rendered output
>
> Run: `yarn vitest run --project client src/components/RatingsPanel/__tests__/RatingsPanel.test.tsx`
> Confirm GREEN. Do not modify any other files.

After the subagent completes, verify the test passes in the main context and commit:
`feat: display resolved cross-provider IDs in RatingsPanel`.

---

## Acceptance criteria

- `GET /api/providers/ratings?title=X` response body includes `ids: { tmdbId, imdbId, tvdbId, tvMazeId }` with whatever was resolved
- When TMDB and OMDB both found a match and their `imdbId` values disagree, a `console.warn` is emitted server-side
- RatingsPanel shows a compact ID list when at least one ID is present
- All existing tests continue to pass — no regressions
- No new API calls introduced
- Two commits: one for server changes, one for UI
