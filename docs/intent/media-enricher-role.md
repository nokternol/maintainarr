# MediaEnricher role (target model)

**Status:** INTENT (target model, not built). Detailed spec of the **MediaEnricher** role under the
umbrella `docs/intent/system-roles-and-capabilities.md` — the sibling of `docs/intent/provider-source-model.md`
(which is the detailed spec of **MediaSource**). The as-built enrichment mechanism is recorded in
`docs/architecture/provider-roles-and-identity.md`; this document is the corrective target it evolves to.

This doc closes a naming-and-ownership drift discovered in the role extraction: the as-built
`MetadataEnricher` interface (`server/providers/roles.ts`) is the *opposite* of the role it names.

## The drift being closed

```ts
// as-built — server/providers/roles.ts
interface MetadataEnricher { readonly enrichmentSourceType: 'RADARR' | 'SONARR'; }
```

Three faults, one root cause:

1. **It is the MediaSource identity key wearing an enricher's name.** `enrichmentSourceType: 'RADARR' |
   'SONARR'` is byte-identical to `MediaSource.enrichmentSourceType` — the *owner* type used by
   `mergeEnrichment(..., 'RADARR'|'SONARR', ...)` to find an owner's own rows in `media_identity`. So the
   enricher contract embeds "which media I **own**" — the exact inverse of "metadata about media I do
   **not** own."
2. **Only the owners implement it.** Radarr and Sonarr `implements MetadataEnricher`; the genuine
   enrichers (Plex, Tautulli, Overseerr, TMDB) declare no role.
3. **The real mechanism never uses it.** `EnrichmentJob` hardcodes per-provider branches, each via a pure
   mapper producing contributions keyed by a logical key. That *is* the role — but duck-typed in the job,
   invisible as a contract.

Root cause: the role was named in the `Metadata*` family and modelled off the owner's merge key instead
of the enricher's logical key. The fix is a rename **and** a re-grounding of the contract.

## The role

A **MediaEnricher** is a configured system that contributes metadata about media **it does not own**,
joined to the catalog by a **shared logical key** (`tmdbId` / `tvdbId` / `imdbId` / `plexRatingKey`). It
decorates the canonical media model; it knows nothing about which system *owns* the item, nor the item's
`contentType`.

**Name:** `MediaEnricher`, not `MetadataEnricher`. The core noun is `MediaItem` (a view is a
`MediaItemSet`); every role that acts on media is `Media*` — `MediaSource`, `MediaEnricher`,
`MediaActuator`. `Metadata*` is the residue of the pre-rename vocabulary (cf. `BaseMetadataProvider` →
`BaseProviderConnection`).

**Membership (declared, never assumed):**

| System | MediaEnricher? | Why |
|---|---|---|
| Plex, Tautulli, Overseerr, TMDB | **yes** | contribute data about media owned by Radarr/Sonarr, matched by logical key |
| Radarr, Sonarr | **no** | they are `MediaSource` (+`MediaActuator`); their tags/quality/genres are Source fields on their own `MediaItem` rows, not enrichment of others' media |

Radarr/Sonarr being *not* enrichers is the correction to the umbrella doc's earlier "Radarr is all
three." A field carried on a system's own Source rows is Source data; enrichment is strictly about media
a system does not own.

## The contract

```ts
interface MediaEnricher {
  enrich(items: MediaItem[]): Promise<EnrichmentResult>;
}

// internal to the enrichment job — provenance carrier, never persisted, never crosses a read boundary
interface EnrichmentResult { provider: MetadataProviderType; items: MediaItem[]; }
```

- `enrich` receives canonical `MediaItem`s already hydrated with their cross-provider keys (`_sourceIds`),
  matches on the key **it** speaks (`_sourceIds.plex`, `_sourceIds.tmdb`, …), and returns **only the
  items it touched**, decorated with **only its fields**, tagged with its provider.
- The enricher never sees `RADARR`/`SONARR` or `contentType`. The only outward type it imports is
  `MediaItem`.
- The behavioral method is a **thin shell over a pure mapper** (the existing `mapTautulliHistory` /
  `mapPlexItems` / `mapOverseerr` logic): fetch in the shell, transform in the pure core, so the hard
  logic stays mock-free testable.

## The shared model is the canonical MediaItem

`NormalizedMovie`/`NormalizedShow` (the `MediaItem`) already carries **both halves** enrichment needs:
the match keys (`_sourceIds: { radarr?, plex?, tmdb?, imdb? }`) and the fill slots (`playCount`,
`lastWatchedAt`, `overseerrHasIssue`, `overseerrRequestStatus`, `tmdbStatus`, …). So the item **is** the
contract.

`EnrichmentContribution` / `EnrichmentKey` / `EnrichmentValues` / `toEnrichmentValues` and the
`utils/contributions.ts` token-merge were never the domain — they were a **transport format for a
centralized merge**. The old design kept providers enrichment-agnostic and folded heterogeneous
`{key, values}` fragments onto identities in one generic matcher. Once each `MediaEnricher` owns its own
match-and-decorate, the interim lingua franca has no reason to exist and **retires**.

## The job flow (EnrichmentJob = executor)

```
items     = hydrate(identities)                 // MediaItem with _sourceIds resolved (identity layer)
results   = await Promise.all(                   // each enricher returns { provider, items }
              enrichers.map(e => e.enrich(items)))
canonical = resolvePrecedence(results, POLICY)   // per-field resolution → clean MediaItem[]
persist(canonical)                               // cache projection for cheap reads
```

`EnrichmentJob` is a scheduled executor, not the hot path — enrichers do live fetches, so their output is
**cached** and refreshed on staleness; browse/preview/executor read the cache cheaply.

### Cross-enricher precedence is a per-field policy

Two enrichers can speak to one canonical field (`playCount` from Tautulli **or** Plex). Global enricher
ordering can't express this — precedence can differ per field. So it is a small declarative map consumed
by a **pure** `resolvePrecedence`:

```ts
const POLICY = {
  playCount:          [TAUTULLI, PLEX],
  lastWatchedAt:      [TAUTULLI, PLEX],
  overseerrHasIssue:  [OVERSEERR],
  overseerrRequestStatus: [OVERSEERR],
  tmdbStatus:         [TMDB],
};
```

This replaces the implicit `??` chains in today's `mergeEnrichment` (`tautulliPlayCount ?? plexViewCount`),
moving them from read-time to an explicit, testable write-time resolver.

### Storage holds resolved canonical values

Precedence runs at write time, so the cache stores **resolved** fields (`playCount`), not provider-shaped
columns (`tautulliPlayCount`/`plexViewCount`) side by side. Read-time `mergeEnrichment` collapses to a
trivial copy of canonical columns onto items. Storage-level provenance is discarded — acceptable because
the job recomputes from all enrichers on every staleness pass. **Requires a `media_enrichment` migration.**

## What stays (it is not enrichment)

**Identity resolution** (`media_identity`, `IdentityResolutionJob`) stays — it is a Source/identity
concern. It is what lets a Radarr-owned item learn its `plexRatingKey` (Radarr never knew it), hydrating
`_sourceIds` so a `MediaEnricher` has a key to match. It is upstream of, and separate from, enrichment.

## What retires

- `MetadataEnricher` interface (renamed `MediaEnricher`, re-grounded).
- `EnrichmentContribution`, `EnrichmentKey`, `EnrichmentValues`, `toEnrichmentValues`.
- `utils/contributions.ts` generic token-merge (`mergeContributions`).
- `EnrichmentJob.collectBulkContributions` hardcoded per-provider branches → uniform `enrichers` iteration.
- `mergeEnrichment`'s `??` precedence → `resolvePrecedence` policy at write time.
- `media_enrichment` provider-specific columns → canonical columns.

## Path to close the drift (sequenced, TDD-able)

1. **Rename** `MetadataEnricher` → `MediaEnricher`; remove it from Radarr/Sonarr; align doc/glossary
   vocabulary. (Pure rename + membership correction; guarded by existing tests.)
2. **Introduce the behavioral contract** `enrich(items) → EnrichmentResult` on the genuine enrichers
   (Plex/Tautulli/Overseerr), each a thin shell over its existing pure mapper.
3. **Introduce `resolvePrecedence` + POLICY**; have `EnrichmentJob` iterate `enrichers` uniformly and
   resolve per-field. Delete `collectBulkContributions` branches.
4. **Bring TMDB into the role** as a `MediaEnricher` (the original "fix `TmdbProvider`" — now well-formed:
   it decorates `tmdbStatus`/rating/certification keyed by `_sourceIds.tmdb`).
5. **Collapse `media_enrichment`** to canonical columns; reduce `mergeEnrichment` to a copy; retire
   `EnrichmentContribution` and `contributions.ts`.

Ordered so each step is green under existing tests before the next; the interim `MediaItem` contract makes
every step a local change.
</content>
