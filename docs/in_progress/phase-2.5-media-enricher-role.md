# Phase 2.5 — MediaEnricher role & enrichment cohesion

**Status:** PLANNED (not started) — **Phase 2.5** of the System-Roles & MediaQueryEngine Heal
(see `README.md`). TDD (backend). **Depends on:** Phase 2 (roles named; actuator realised).
**Gates Phase 3** — the server role model must be closed and cohesive before the client (Phase 3, expressly
client-side) derives from it. Target model: `docs/intent/media-enricher-role.md`.

## Why this phase exists

Phase 2 named the three roles but shipped `MetadataEnricher` as the **inverse of the role it names**: its
only field, `enrichmentSourceType: 'RADARR' | 'SONARR'`, is the *owner's* identity key (a `MediaSource`
concern), it is implemented **only** by the owners (Radarr/Sonarr), and the genuine enrichers
(Plex/Tautulli/Overseerr/TMDB) declare no role. The real enrichment behaviour is duck-typed inside
`EnrichmentJob`. The server's role model is therefore **not yet cohesive** — and Phase 3 would derive a
client contract from a half-built server truth. This phase closes that before the boundary is crossed.

The full rationale (why `MediaEnricher` not `MetadataEnricher`, why the canonical `MediaItem` is the
shared model, why `EnrichmentContribution` retires) lives in `docs/intent/media-enricher-role.md`. This
doc is the TDD cycle plan that realises it.

## Observable value

- **Role honesty:** the genuine enrichers (Plex, Tautulli, Overseerr, TMDB) `implements MediaEnricher`;
  the owners (Radarr, Sonarr) do not — their tags/quality are Source fields.
- **One shared model:** an enricher decorates the canonical `MediaItem`; the enrichment-specific transport
  domain (`EnrichmentContribution`/`EnrichmentKey`/`EnrichmentValues`/`contributions.ts`) is gone.
- **Explicit precedence:** cross-enricher field resolution is a per-field policy, not an implicit `??`
  chain or enricher ordering.
- **TMDB is a real enricher:** it decorates `tmdbStatus`/rating/certification keyed by `_sourceIds.tmdb`.

## Design

Per `docs/intent/media-enricher-role.md`:

```ts
interface MediaEnricher { enrich(items: MediaItem[]): Promise<EnrichmentResult>; }
interface EnrichmentResult { provider: MetadataProviderType; items: MediaItem[]; } // job-internal
```

- `enrich` matches on `_sourceIds`, returns only touched items with only its fields, tagged by provider.
  A thin shell over the existing pure mapper.
- `EnrichmentJob` iterates `enrichers` uniformly, then `resolvePrecedence(results, POLICY)` resolves
  per-field at write time; the cache (`media_enrichment`) stores **resolved canonical** columns; read-time
  `mergeEnrichment` becomes a trivial copy.
- Identity resolution (`media_identity`) is unchanged — it hydrates `_sourceIds` (the "what to map to").

## Mocking

| Mock target | Boundary / Internal | Justification |
|---|---|---|
| provider HTTP (Plex/Tautulli/Overseerr/TMDB fetch) | Boundary | external APIs; not under test |
| pure mappers / `resolvePrecedence` | Internal | the logic under test; exercised, never mocked |
| DB (`media_enrichment`, `media_identity`) | Boundary | integration cycles use the real test DB |

## TDD cycles

1. **Rename `MetadataEnricher` → `MediaEnricher`; correct membership.** REFACTOR-under-guard: remove the
   role from Radarr/Sonarr, drop the owner-key field, leave a bare role marker temporarily. Existing tests
   stay green. *(Structural; no new behaviour. The owner-key field moves to / stays on `MediaSource`.)*
2. **`enrich(items)` decorates a matched item (one enricher).** RED: `PlexEnricher.enrich([item])` with a
   matching `_sourceIds.plex` returns `{ provider: PLEX, items: [item with plexViewCount set] }`. GREEN:
   thin shell over `mapPlexItems`. REFACTOR.
3. **An unmatched item is left untouched.** RED: `enrich` over an item whose key the enricher doesn't
   speak returns it undecorated (boundary). GREEN. REFACTOR.
4. **`resolvePrecedence` resolves a field per policy.** RED: two `EnrichmentResult`s set `playCount`
   (Tautulli=5, Plex=2); policy `playCount:[TAUTULLI,PLEX]` → resolved `playCount=5`. GREEN: pure resolver
   over the policy map. REFACTOR.
5. **`EnrichmentJob` produces resolved enrichment via the enrichers.** RED (integration): with the three
   enrichers wired, a stale identity is enriched and `media_enrichment` holds the resolved canonical value.
   GREEN: iterate `enrichers`, `resolvePrecedence`, persist. REFACTOR: delete
   `collectBulkContributions` branches.
6. **TMDB is an enricher.** RED: `TmdbProvider.enrich([item])` with `_sourceIds.tmdb` set decorates
   `tmdbStatus`. GREEN: implement `enrich`. REFACTOR: `implements MediaEnricher`.
7. **Read path copies canonical columns.** RED: `mergeEnrichment` over an item with a resolved
   `media_enrichment` row sets `item.playCount` from the canonical column. GREEN: trivial copy. REFACTOR:
   collapse `media_enrichment` to canonical columns (migration); retire `EnrichmentContribution`,
   `EnrichmentKey`, `EnrichmentValues`, `utils/contributions.ts`.

## Gates

- `yarn test` (vitest) — existing `enrichmentJob`, `mappers`, `mergeEnrichment`, browse/executor
  integration green throughout; new enricher + precedence tests green.
- `yarn typecheck:server`, `yarn lint`. `graphify update .` at the end.
- On completion: fold the now-built model into `docs/architecture/provider-roles-and-identity.md`
  (the enricher section), update the drift notes to as-built, move `docs/intent/media-enricher-role.md`
  to `docs/architecture/`, and delete this file.

## Out of scope

- Any client change — Phase 3 derives from the closed server model.
- Adding new enrichable fields — this phase moves the existing field set onto the role; new metadata is
  separate.
</content>
