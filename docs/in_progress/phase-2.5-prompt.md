# Phase 2.5 prompt — MediaEnricher role & enrichment cohesion

Invocation: `tdd docs/in_progress/phase-2.5-prompt.md docs/in_progress/phase-2.5-media-enricher-role.md`

Read `AGENT_BRIEF.md` first, then the cycle doc and the model it realises:
`docs/intent/media-enricher-role.md` (the contract, membership, and why `EnrichmentContribution` retires)
+ `docs/architecture/provider-roles-and-identity.md` (as-built source/enricher tiering, with the drift
notes). Depends on Phase 2; **gates Phase 3** — close the server role model before any client work.

## The seams (verified)
- **Mis-grounded role** — `server/providers/roles.ts` `MetadataEnricher { enrichmentSourceType:
  'RADARR'|'SONARR' }`, `implements`-ed only on `radarrProvider.ts` / `sonarrProvider.ts`. The field is a
  duplicate of `MediaSource.enrichmentSourceType` (`server/providers/mediaSource.ts`).
- **The real mechanism** — `server/jobs/enrichmentJob.ts` `collectBulkContributions()` hardcodes
  Tautulli/Plex/Overseerr branches; pure transforms in `server/jobs/enrichment/mappers.ts`; interim
  shapes in `server/jobs/enrichment/types.ts`; generic token-merge in `server/utils/contributions.ts`.
- **Read merge** — `server/services/enrichmentMerge.ts` `mergeEnrichment(...)` applies the `??` precedence
  (`tautulliPlayCount ?? plexViewCount`) onto `Normalized*` at read time.
- **Canonical item** — `server/domain/movie.ts` / `show.ts`: `_sourceIds` (match keys) + the enrichment
  fill slots already coexist. This is the shared model the enrichers decorate.
- **Storage** — `media_enrichment` (`server/database/schema.ts`) provider-specific columns →
  canonical columns (migration in the last cycle).

## Refactor-under-guard cycles
Cycle 1 (rename + remove from owners) and the deletions in cycles 5/7 (`collectBulkContributions`
branches, `EnrichmentContribution`/`contributions.ts`) are structural — guarded by existing
`enrichmentJob` / `mappers` / `mergeEnrichment` tests. The genuine RED targets are the behavioral
`enrich` (2, 3, 6), `resolvePrecedence` (4), the job integration (5), and the read copy (7).

## Traps
- **Keep the pure mappers as the functional core.** `enrich` is a thin shell (fetch in shell, transform in
  the pure mapper) so the mock-free mapper tests survive. Do not fold I/O into the transform.
- **Provenance is a job-internal wrapper** (`EnrichmentResult { provider, items }`) — never persisted,
  never on the `MediaItem`, never across a read boundary.
- **Precedence is per-field policy**, not enricher ordering — ordering cannot express different precedence
  per field.
- **Owners are not enrichers.** Radarr/Sonarr tags/quality/genres are Source fields on their own rows; do
  not re-add an enricher role to them. The owner-key field belongs to `MediaSource`.
- Do **not** touch the client — Phase 3 derives from the closed server model.

## Done when
Per the spec: the genuine enrichers `implements MediaEnricher` and decorate the canonical `MediaItem`; the
owners do not; precedence is an explicit per-field policy resolved at write time; `media_enrichment` holds
resolved canonical columns; `EnrichmentContribution` and the token-merge are gone; TMDB is a real
enricher. The server role model is cohesive and ready for Phase 3 to derive from.
</content>
