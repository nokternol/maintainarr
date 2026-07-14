# `MediaFieldProvider`/`MediaFieldSource`: closing the field-ownership/precedence/gating duplication

Replaces three hand-copied field-ownership declarations (`movie.ts`/`show.ts`'s enrichable
properties, `ENRICHMENT_POLICY`, `filterRegistry.ts`'s `sourceProviders`) with one real
declaration per field, checked structurally instead of kept in sync by hand.

Jira: none — local markdown tracker (see `CLAUDE.local.md`). Design closed via wayfinder map
[`docs/plans/media-item-field-registry-map.md`](../plans/media-item-field-registry-map.md);
full rationale in [`docs/intent/media-item-field-registry.md`](../intent/media-item-field-registry.md).

---

## Decisions Made

**A fourth media-owned role, `MediaFieldProvider`, alongside the shipped `MediaSource`/
`MediaEnricher`/`MediaActuator` tiers.** `providers/` keeps owning configuration/CRUD;
`media/` owns all usage — the same boundary already drawn for the other two roles, not a new
one. Only media-owned adapters bind a provider connection to the role; `providers → media`
stays illegal in both directions.

**Two distinct types per field, not one, because a real transform sits between them.** A
provider's own representation (`MediaField` — e.g. Tautulli's raw bitfield) and `MediaItem`'s
canonical post-precedence representation (`EnrichmentField` — e.g. a boolean) are kept as
separate types joined by an explicit, checked `toEnrichmentFields()` transform. Collapsing them
into one shared type would force a cast at exactly the point a real conversion needs proving —
casts override inference, the opposite of what's needed here. `EnrichmentFields` is a single,
central, hand-authored, type-only mapped type (never read/branched on at runtime) that every
adapter's output is checked against — not a runtime lookup table (rejected: reintroduces drift
risk) and not derived by unioning every provider's own shape (rejected: a prototype showed
`TautulliFields & PlexFields` with conflicting field types compiles fine and silently collapses
the field to `never` — it only fails where a value is actually *constructed* at that shape, not
at declaration/use sites, so it doesn't function as an automatic conflict alarm).

**No separate `fieldShape` witness property.** A prototype confirmed it does zero enforcement
work on its own — constructed via an `as unknown as TFields` cast, checked against nothing. All
real enforcement comes from `visit()`/`toEnrichmentFields()`'s ordinary declared return types.
`TFields extends Partial<EnrichmentFields>` (not `Record<string, unknown>`, which rejects any
concrete interface lacking an index signature).

**Two separate interfaces, not one, because construction shape differs between enrichment and
source data:**
- `MediaFieldProvider<TMediaField, TFields>` — `visit(raw): Map<string, TMediaField>` (mapper
  logic relocated onto the adapter, replacing `enrichment/mappers.ts`'s standalone functions) +
  `toEnrichmentFields(native): TFields`. For `MediaEnricher`-style adapters (Tautulli, Plex,
  Overseerr, TMDB) that decorate fields onto an *already-existing* item, joined by key across a
  batch (`decorate()`).
- `MediaFieldSource<TMediaField, TFields>` — just `toEnrichmentFields(native): TFields`, no
  `visit()`/`Map`/join. For `MediaSource`-style construction (`normalizeRadarrMovie`/
  `normalizeSonarrSeries`), which builds the entire canonical item from one raw item, always 1:1,
  with no existing item to decorate and no batch to join. A prototype confirmed both interfaces
  catch a provider field rename (e.g. Radarr `tags`→`labels`) identically via ordinary
  return-type checking — `MediaFieldProvider`'s batch/key/join machinery would buy no extra
  safety here, only permanent ceremony.

Both interfaces are checked against the same central `EnrichmentFields`, so a source field and an
enrichment field can never disagree on type regardless of which interface declares them.

**Precedence is separate business logic, not `MediaFieldProvider`'s concern, and an ordered
total order, not a numeric rank.** `playCount` is legitimately owned by both Tautulli and Plex;
precedence encodes a deliberate trust judgment (Tautulli wins — it tracks completed plays, not
opens), not a race-breaker, so **a tie is never a valid state.** A prototype rejected a
freely-chosen numeric-rank candidate because nothing stops two adapters independently picking the
same number — that only ever catches a collision after the fact. Decided:
`contestedFieldPrecedence: Partial<{ [K in keyof EnrichmentFields]: readonly [Provider,
...Provider[]] }>`, declared once per contested field, scoped only to fields with more than one
actual competing producer (an uncontested field needs no entry — nothing to order). An array's
positions can't collide, so a tie is structurally unrepresentable rather than merely forbidden by
convention. The fail-fast check for an uncovered contested field hooks directly into
`assertNoActiveConflict`'s call site (`providerSettingsService.ts`, provider create/update) — not
built on the active field set's cache, since the two concerns are unrelated and the scenario
isn't reachable under today's fixed 2-provider contested set anyway.

**The active field set replaces per-request gating intersection, and answers `sourceProviders`
too.** Compute the union of every currently-configured provider's declared `MediaFieldProvider`/
`MediaFieldSource` fields exactly once, cache it, invalidate on provider-config-change (the same
event `assertNoActiveConflict` reacts to). `filterRegistry.ts`'s `sourceProviders` needs a
*membership* answer ("who can produce this field at all," including plain single-owner fields
with zero contention) — that's `MediaFieldProvider`'s ownership question, not precedence's
(precedence only orders an already-established membership set) — so `sourceProviders`
consolidates onto the active field set rather than needing its own mechanism.

**"Active" means provider-configured only — data presence is explicitly out of scope.** Whether a
field has actually been *observed populated* is a separate, harder, unscoped question (a provider
can have data then be disabled; a completed enrichment pass can still lack data for an item for
its own reasons). If ever tackled, it composes as a stricter filter on top of the active field
set, not instead of it — nothing here needs to change to leave room for it.

**Instance-scoping stays fully orthogonal — no change needed.** `instanceScoped` (shipped for
`tagIds`/`qualityProfileIds`) is a fact about how a field's *value* is interpreted/compared at
predicate-match time, not about its existence/type — the only things `MediaFieldProvider`/
`MediaFieldSource` declare. It stays a hand-authored `MediaRule` fact, same bucket as the
already-manual predicate/label/dataType authorship.

**Three known-stale `sourceProviders` entries get corrected as part of this work**, confirmed
against the real provider stack (see
[Media provider catalog](../architecture/media-providers.md)): `genres: [RADARR, TMDB]` and
`imdbRating: [RADARR, OMDB]` are already 100% Radarr-owned (no TMDB/OMDB call exists or is
needed) → correct to `[RADARR]`. `communityRating: [SONARR, TMDB]` — Sonarr's `ratings` is a
single aggregate, no TMDB key configured anywhere → correct to `[SONARR]`. `network: [SONARR,
TVMAZE]` is real and buildable (TVMaze's public API is keyless, confirmed live) but has no
adapter yet — `TVMAZE` stays listed as a known, real, not-yet-built gap, not folded into gating
computation until an adapter exists (out of scope for this spec — see Risks/Dependencies).

**Client and API: no change.** `useMediaRules`/`MediaFilterBar` already consume
`MediaRuleDescriptor[]` generically; `GET /api/filter-fields`'s response shape is unchanged. Only
`gatedDescriptors`'s internal gating source changes, from a live per-request intersection to a
cache read.

**Guardrails — what this does *not* solve, to avoid reintroducing the duplication it closes:**
`MediaRule`'s predicate/label/dataType authorship stays manual (a field's existence is derivable;
*how a filter for it behaves* is a human decision, not auto-generated from field declarations).
Precedence's exact fail-fast trigger mechanics are pinned down here (hooks
`assertNoActiveConflict` directly) but the shape was the open question this spec closes, not an
invitation to grow further ad hoc checks. Data presence stays explicitly out of scope, not
implicitly deferred.

---

## Key Files

| File | Role |
|------|------|
| `server/modules/media/mediaFieldProvider.ts` (new) | `MediaFieldProvider<TMediaField, TFields>`, `MediaFieldSource<TMediaField, TFields>`, the central `EnrichmentFields` type. Establishes the pattern every adapter conforms to. |
| `server/modules/media/enrichment/enricherAdapters.ts` | Modified: Tautulli/Plex/Overseerr/TMDB each also implement `MediaFieldProvider`, one adapter at a time. |
| `server/modules/media/enrichment/mappers.ts` | Deleted incrementally — each standalone mapper function (`mapTautulliHistory`, `mapPlexItems`, `mapOverseerr`) removed as its adapter converts; file deleted once empty. |
| `server/modules/media/enrichment/enricher.ts` | Modified: `EnrichableField` (hardcoded union) replaced by a reference to `EnrichmentFields` (e.g. `keyof EnrichmentFields`). |
| `server/modules/media/enrichment/precedence.ts` | Modified: `ENRICHMENT_POLICY`/`PrecedencePolicy` replaced by `contestedFieldPrecedence`; `resolvePrecedence` rewritten to consume it (ordered lookup for contested fields, direct pass-through for single-producer fields). |
| `server/modules/media/enrichmentJob.ts` | Modified: rewired to the new precedence merge function in the same commit as the `precedence.ts` swap. |
| `server/modules/media/movie.ts`, `show.ts` | Modified last in the field-ownership track: hand-listed enrichable properties become derived from `EnrichmentFields` (e.g. `Partial<Pick<EnrichmentFields, ...>>`) once it covers all 5 enrichment fields. |
| `server/modules/media/normalizeMedia.ts` | Modified: `normalizeRadarrMovie`/`normalizeSonarrSeries`'s `tags`/`qualityProfileId` conversion goes through a `MediaFieldSource` implementation. |
| `server/modules/media/sourceAdapters.ts` | Modified: Radarr/Sonarr source adapters also implement `MediaFieldSource` for `tags`/`qualityProfileId`. |
| `server/modules/media/filterRegistry.ts` | Modified: `sourceProviders` swapped from hand-listed arrays to a derived lookup against the active field set, keyed by the field each rule's predicate reads; the 3 stale entries (`genres`/`imdbRating`/`communityRating`) corrected first, independently. |
| `server/modules/media/media.filterFields.handler.ts` | Modified: `gatedDescriptors` reads the cached active field set instead of its live per-request `sourceProviders`/`configuredTypes` intersection. |
| `server/modules/providers/providerSettingsService.ts` | Modified: `assertNoActiveConflict`'s call site (provider create/update) gains two new hooks — the active-field-set cache invalidation trigger, and the "uncovered contested field" precedence fail-fast check. |
| `docs/architecture/provider-roles-and-identity.md` | Reference only, unmodified — the `MediaSource`/`MediaEnricher` pattern this role extends. |
| `docs/architecture/media-providers.md` | Reference only, unmodified — ground truth for which providers are real/buildable vs. unbuilt (TVMaze real; OMDB/TMDB-for-`communityRating` unbuilt, no key configured). |

---

## Deliverable Value

- I know this feature works because adding a second enrichment provider that produces an existing
  field with a conflicting type fails to compile, rather than silently merging incompatible data.
- I know this feature works because renaming a field on a provider's raw API response (e.g.
  Radarr's `tags`, Tautulli's watched-state bitfield) breaks the build at the adapter's transform,
  not silently at runtime.
- I know this feature works because a contested field's precedence order (e.g. `playCount`:
  Tautulli before Plex) is declared exactly once, in one place, and activating a second provider
  that produces an already-contested field without a covering precedence entry fails loudly at
  provider-activation time instead of silently defaulting to an accident of ordering.
- I know this feature works because `GET /api/filter-fields`'s gated field list is computed from
  one authoritative source instead of three independently hand-maintained lists that can drift.
- I know this feature works because the three known-wrong `sourceProviders` entries
  (`genres`/`imdbRating`/`communityRating`) now reflect their real single owner (Radarr/Sonarr)
  instead of implying a TMDB/OMDB integration that doesn't exist in this deployment.
- I know this feature works because the client (`MediaFilterBar`, `useMediaRules`,
  `useMediaFilters`) requires zero changes and `GET /api/filter-fields`'s response shape is
  provably identical before and after.

---

## Risks / Dependencies

**Risks:**
- Three migration tracks (field-ownership, precedence, gating) are mostly independent but not
  entirely: precedence's type wiring (`contestedFieldPrecedence`'s reference to
  `EnrichmentFields`) depends on the field-ownership track's `EnrichableField`→`EnrichmentFields`
  relocation landing first. Sequence accordingly.
- `mappers.ts` exists in a partially-migrated state for several commits while adapters convert
  one at a time — watch for dead exports left behind after each conversion.
- The `as`-cast sharp edge: wrapping a `toEnrichmentFields()` return in an `as` cast silently
  defeats the type check, same as any TypeScript cast. Accepted as an ordinary, already-understood
  gotcha — no new lint rule proposed.
- `automationExecutor` is expected to need no change (it consumes predicate results/identity ids,
  not field ownership directly) but this was flagged as needing confirmation during
  implementation, not verified as part of the design.

**Dependencies:**
- Building a TVMaze `MediaEnricher`/`MediaFieldProvider` adapter (to make `network`'s `TVMAZE`
  `sourceProviders` entry real/gating) and any future TMDB integration for `communityRating` are
  explicitly out of scope — real, confirmed-buildable follow-on work, not part of this spec.
- Data-presence-aware field gating (has this provider's enrichment actually populated a value, as
  opposed to merely being configured) is explicitly out of scope entirely, by design.
- Relies on `assertNoActiveConflict` (`providerSettingsService.ts`) remaining the provider-config-
  change hook point for both new triggers (active-field-set invalidation, precedence fail-fast).

**Verification notes:**
- No UI/visual changes — client is explicitly unchanged. Verification is server-side: existing
  `filterFields.integration.test.ts`, enrichment job tests, and `tsc --strict` for the type-level
  drift-catching guarantees this design is built around.
- Confirm `automationExecutor` truly has no behavior change during implementation (see Risks).
