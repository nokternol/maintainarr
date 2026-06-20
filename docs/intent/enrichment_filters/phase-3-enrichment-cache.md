# Phase 3 — Enrichment Cache & Invalidation

**Status:** INTENT (reverted from in-flight) — **Phase 3** of the Realtime & Event-Driven Cache plan (see `README.md`).
TDD (backend). **Depends on:** Phase 2 (`media:changed`). Resolves the standing Phase 2 debt
("enrichment merge is uncached").

## Observable value

After a `media:changed`, the **next** `listMovies`/`listSeries` re-fetches the
identity+enrichment maps from the DB; with no event, repeated reads do **not** re-issue those queries.
Three boundary behaviours, each assertable by counting DB round-trips (spy on the lookup):

- **Cache hit:** two reads in a row → one set of identity+enrichment queries, not two.
- **Event eviction:** `media:changed` (matching scope) between two reads → the second re-fetches.
- **Self-heal:** with the cache hot and **no** event, a read after the absolute 5-min TTL re-fetches.

## Problem

`listMovies`/`listSeries` serve provider lists from `MediaCache` (`server/modules/media/media.cache.ts`
— `moviesCache`/`seriesCache`, 60s TTL + `invalidate()` + in-flight dedup), but `mergeEnrichment`
(`server/services/enrichmentMerge.ts`) issues **two DB queries (identity + enrichment) on every
request** regardless of cache state. The old `watchedTitlesCache` that softened this was removed and
nothing replaced it.

## What we cache: the lookup maps (not the merged result)

Add one `enrichmentCache` (reuse `MediaCache`) holding the **identity + enrichment rows** — the maps
the merge reads. Provider lists keep their own `moviesCache`/`seriesCache`. The merge still runs
in-memory per request (cheap map lookups); only the DB round-trips are removed.

**Why maps, not the merged `Normalized*` result** — they have *different invalidation lifetimes*:
- Provider lists change when a user unmonitors/deletes, and drift from the *arr app → short 60s TTL.
- Enrichment maps change only when a data job writes → `media:changed`.

A user unmonitoring a movie must **not** evict enrichment (playcount is unaffected by the monitored
flag). Caching the *merged* result would force one entry to be invalidated by both unrelated causes,
multiplying churn. Separate caches = each invalidated only by its own cause. (Trade accepted:
re-normalise + re-merge per request is CPU, not I/O; at Warden's sizes the DB round-trips dominate.)

## Freshness: event-invalidation primary, absolute 5-min TTL backstop

- **Primary:** `media:changed` evicts the moment data changes — steady state is event-driven freshness
  with zero needless DB hits.
- **Backstop:** an **absolute** 5-minute TTL (from fetch, as `MediaCache.fetchedAt` already does), so a
  missed/forgotten emit self-heals within 5 minutes instead of going stale forever.

The TTL must be **absolute, not sliding.** A sliding window that resets on every *read* never expires
on a hot cache (a grid being actively viewed), so it could never self-heal a missed emit — which is the
backstop's only purpose. Provider lists stay at their own 60s (they drift from outside Warden).

## Invalidation: correctness vs thrash

- **Correctness** = invalidate *at least* whenever data changed. Scope-level eviction achieves this;
  it is never wrong, only sometimes over-eager (consistent with the count-as-gate contract).
- **Thrash** = under Run Now + many overlapping data tasks, N rapid `media:changed` → N evict/refetch
  cycles. A *performance* concern, handled by debounce.

> **Watch-item — scheduled enrichment re-eviction.** `system:enrichment` re-writes any *stale* identity
> row (bumping `enrichedAt`) even when the merged values are unchanged, so it emits `media:changed` on
> every scheduled pass, evicting the whole media cache. The absolute 5-min TTL and ~250ms debounce make
> this harmless at normal cadence, but a very frequent enrichment schedule becomes a source of
> steady-state full-cache eviction. If observed, this is the trigger for segmented/keyed eviction below
> — not a v1 concern.

### v1: whole-scope + debounce

- `media:changed` carries no discriminator, so it evicts the **whole media cache** (movies and series).
  The cache is not segmented in v1 — matching the event's deliberately empty payload.
- The bus→cache consumer **debounces ~250ms**: an overlapping-task burst, or a Run-Now-triggered job,
  collapses to a single eviction.

### Deferred (documented, not built)

Segmented eviction (movies vs series) and, beyond it, per-identity targeted eviction plus a durable,
ordered invalidation queue are the evolution path for heavy overlap. The **seam** is the bus→cache
consumer. If segmentation is built, the within-scope discriminator is introduced **on the event then**,
in the cache's own vocabulary (e.g. `movie`/`show` — the kind the cache partitions on, not the
provider-source axis). The trigger to build it is observed thrash hurting UX, not anticipation.

## Out of scope

`media:changed` is the only cache trigger. Run lifecycle (`run:completed` for a backup, update-check,
etc.) must **not** invalidate — that precision is the whole reason `media:changed` exists separately.

## TDD cycles

1. **`enrichmentCache` caches the maps.** RED: two consecutive `listMovies` issue the identity+
   enrichment queries **once** (spy/counter on the lookup). GREEN: wrap the map lookup in a
   `MediaCache` with `getOrFetch`. REFACTOR: share the cache shape with the existing provider caches.
2. **Absolute TTL backstop.** RED: with the cache hot and no event, a read past 5 minutes (clock
   advanced) re-fetches; a read at 4:59 does not. GREEN: absolute expiry from `fetchedAt`. REFACTOR.
3. **`media:changed` evicts the media cache.** RED: with both lists cached, a `media:changed` makes the
   next `listMovies` **and** `listSeries` re-fetch (whole-scope eviction). GREEN: subscribe the cache
   consumer to the bus and clear the media cache on the event. REFACTOR.
4. **Wrong trigger does not evict.** RED: a `run:completed` for a backup (no `media:changed`) leaves the
   enrichment cache intact. GREEN: ensure only `media:changed` is subscribed. REFACTOR.
5. **Debounce collapses a burst.** RED: N `media:changed` within the window → exactly one eviction/
   refetch. GREEN: ~250ms debounce in the consumer. REFACTOR: isolate the debounce so it is the swap
   point for the deferred durable queue.

## Gates

- `yarn test` (vitest) — including the existing `media.cache.lifecycle` / `provider.cache.invalidation`
  integration tests, which must stay green.
- `yarn typecheck:server`, `yarn lint`.

## Done when

The enrichment maps are cached, `media:changed` evicts the right scope with debounce, unrelated run
events never evict, and a missed emit self-heals within the absolute 5-min TTL — all proven by
DB-round-trip assertions.
