# Enrichment Cache & Invalidation

**Status:** INTENT — not yet built. Resolves the Phase 2 open debt ("enrichment merge is uncached").
**Depends on:** `domain-event-bus.md` (consumes `data:changed`).

## Problem

`listMovies` / `listSeries` serve provider lists from the existing per-invocation `MediaCache`
(`moviesCache` / `seriesCache`, 60s TTL + `invalidate()` + in-flight dedup), but `mergeEnrichment`
issues **two DB queries (identity + enrichment) on every request** regardless of cache state. The
old `watchedTitlesCache` (5-min TTL) that used to soften this was removed with the title-matching
path and nothing replaced it.

## What we cache: the enrichment lookup maps (not the merged result)

Add one `enrichmentCache` (reuse `MediaCache`) holding the **identity + enrichment rows** — the maps
the merge reads. Provider lists keep their own `moviesCache` / `seriesCache`. The merge still runs
in-memory per request (cheap map lookups); only the DB round-trips are removed.

**Why maps, not the merged `Normalized*` result:** the two have *different invalidation lifetimes*
and must not be conflated.

- Provider lists change when a user unmonitors/deletes (existing invalidation, and external drift
  from the *arr app → short 60s TTL).
- Enrichment maps change only when a data job writes → `data:changed`.

A user unmonitoring a movie must **not** evict enrichment (playcount is unaffected by the monitored
flag). Caching the *merged* result would force one entry to be invalidated by both unrelated causes,
multiplying churn. Separate caches = each invalidated only by its own cause.

(The trade accepted: re-normalise + re-merge runs per request, CPU not I/O. At Warden's library
sizes the DB round-trips dominate; if the merge itself ever shows up in profiles, revisit caching the
merged result.)

## Freshness: event-invalidation primary, absolute 5-min TTL backstop

- **Primary:** `data:changed` evicts the cache the moment data changes — steady state is event-driven
  freshness with zero needless DB hits.
- **Backstop:** an **absolute** 5-minute TTL (from fetch, as `MediaCache.fetchedAt` already does), so
  a missed/forgotten emit self-heals within 5 minutes instead of going stale forever.

The TTL must be **absolute, not sliding.** A sliding window that resets on every *read* never expires
on a hot cache (a grid being actively viewed), so it could never self-heal a missed emit — which is
the backstop's only purpose. Provider lists stay at their own 60s (they drift from *outside* Warden,
independent of our events).

## Invalidation: correctness vs thrash

These are different problems; conflating them is what makes cache invalidation feel like a full-time
job.

- **Correctness** = invalidate *at least* whenever data changed. Scope-level eviction achieves this;
  it is never wrong, only sometimes over-eager.
- **Thrash** = under Run Now + many overlapping data tasks, N rapid `data:changed` → N evict/refetch
  cycles. A *performance* concern, not correctness.

### v1: scope-selective + debounce

- `data:changed{scope:'media', sourceType}` evicts only the matching list — `RADARR` → movies,
  `SONARR` → series, absent → both. Selective at the level the coarse cache (`'movies'` / `'series'`
  whole-list keys) can actually express.
- The bus → cache consumer **debounces** (~250ms): an overlapping-task burst, or a Run-Now-triggered
  job, collapses to a single eviction.

### Deferred (documented, not built)

Per-identity targeted eviction and a **durable, ordered invalidation queue** are the evolution path
for heavy overlap. The **seam** is exactly the bus → cache consumer: swap the debounce for a real
queue, swap whole-list eviction for keyed eviction — **without touching producers**. Not built in v1;
the trigger to build it is observed thrash hurting UX, not anticipation.

## Out of scope / not invalidated by this

`data:changed` is the only cache trigger. Run lifecycle (`run:completed` for a backup, update-check,
etc.) must **not** invalidate — that precision is the whole reason `data:changed` exists separately.
