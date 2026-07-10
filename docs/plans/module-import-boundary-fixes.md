# Close the provider→media import-boundary gaps before Phase 8 enforcement

**Status:** ready for planning review. Not yet an `in_progress` phase — this spec exists so the
three findings below can be verified, decided on, and turned into an actual North Star phase
(most likely folded into or run just before Phase 8) rather than fixed ad hoc.

## Problem Statement

A Standards-axis code review of North Star Phases 0–7 (diff `520a3ce...HEAD`) flagged three
places where `server/modules/providers/` and `server/modules/mediaQueries/` cross their declared
module boundary into `server/modules/media/` in ways `docs/intent/server-architecture-north-star.md`
either doesn't sanction or doesn't obviously sanction. Phase 8 is supposed to add an automated
import-boundary check that fails CI on exactly this class of violation — if these three findings
are real violations, Phase 8's own gate would fail on day one. The user flagged that the findings
haven't been personally verified and that a straightforward import-path edit may not be the right
fix for all three — some may need a small redesign of what providers and media share, not just a
changed import path.

## Solution

Investigate each of the three findings against the actual code (not just the diff) to determine
which are genuine direction violations needing a redesign, which are the sanctioned-exception
pattern needing only a doc update, and which are trivial deep-import-vs-index fixes. Turn the
answer into a concrete, scoped follow-up phase.

This spec includes the investigation already done (below), since the three findings are not
uniform — they resolve three different ways.

## User Stories

1. As the developer maintaining the North Star migration, I want Phase 8's import-boundary check
   to pass on the first run, so that landing the enforcement tooling doesn't immediately require a
   panic fix.
2. As a future contributor reading `docs/intent/server-architecture-north-star.md`, I want the
   documented `providers → media` exception to match what the code actually needs, so that I can
   tell a sanctioned reference from a real violation without re-deriving the TypeScript
   implementation details myself.
3. As a contributor adding a new provider connection that implements `MediaSource` or
   `MediaEnricher`, I want it to be unambiguous which media types I'm allowed to import and from
   where, so that I don't accidentally reintroduce an unsanctioned coupling.
4. As the developer who wrote the `MediaCache` utility, I want it to live somewhere that reflects
   what it actually is (a generic, domain-agnostic TTL cache), so that its module location doesn't
   keep tempting new deep imports across the providers/media boundary.

## Implementation Decisions

### Finding 1 — `providers → media` imports beyond `mediaSource.ts`/`roles.ts`

**Investigated, not a uniform violation — splits into two groups:**

- **`MediaItem`-as-type in role *implementations* (6 of the 8 files: `connections/radarrProvider.ts`,
  `sonarrProvider.ts`, `plexProvider.ts`, `overseerrProvider.ts`, `tautulliProvider.ts`,
  `tmdbProvider.ts`, plus `enrichment/decorate.ts` and `enrichment/mappers.ts`) — traced back to
  `roles.ts`'s own `MediaEnricher<TField>` interface: `enrich(items: MediaItem[]):
  Promise<EnrichmentResult<TField>>`. Any class implementing `MediaEnricher` or `MediaSource` must
  reference `MediaItem` in its method signature to type-check — the sanctioned exception
  (`mediaSource.ts`, `roles.ts` "reference `MediaItem` directly because a role contract has to name
  the shape it operates on") already establishes *why* this is fine; it just didn't anticipate that
  concrete implementers of that contract need the same reference, not only the contract file
  itself. `enrichment/decorate.ts` and `mappers.ts` already follow the documented pattern precisely
  — every field-level use is `Pick<MediaItem, '...'>`, never the bare full shape except where
  `decorate()`'s generic signature needs it structurally.
  - **Decision: this is not a violation.** Update
    `docs/intent/server-architecture-north-star.md`'s exception clause to read "providers' role
    *contracts and implementations*" instead of naming only `mediaSource.ts`/`roles.ts`, and note in
    the fracture ledger that this was clarified, not changed in code. No source change needed.
- **`radarrProvider.ts`/`sonarrProvider.ts` importing `normalizeRadarrMovie`/`normalizeSonarrSeries`
  (functions, not types)** — these implement `MediaSource.getMediaItems()`, whose entire job is to
  *produce* `MediaItem` values from provider DTOs. The normalize functions are the only sanctioned
  way to do that (they're media's own DTO→canonical translation, exported from media's index
  specifically for this).
  - **Decision: also not a violation**, same reasoning and same doc fix as above — role
    implementations, not just role contracts, are the exception's real boundary.
- **`mediaSourceFactory.ts` importing `ContentType`** — used to key `OWNER_TYPE: Record<ContentType,
  MetadataProviderType>` and to type `forContentType(contentType: ContentType)`. Unlike the above,
  this is not implementing a role contract defined in `roles.ts`/`mediaSource.ts` — it's providers'
  own factory selecting *which* provider serves a content type, and content type (`'movie' |
  'show'`) is unambiguously a media-domain concept, not providers'.
  - **Decision: genuine gap in the documented exception, needs a call before Phase 8** — two
    options, pick one during phase planning rather than in this spec:
    (a) extend the sanctioned exception to name `ContentType` alongside `MediaItem` (it's a small,
    stable enum, arguably closer to a shared primitive than a leaky domain coupling), or
    (b) have providers key `OWNER_TYPE` off `MetadataProviderType` (providers' own enum) and let
    media's `sourceOwnership()` (already the join point, per the fracture ledger's "MediaSource
    ownership vocabulary" entry) do the `ContentType → MetadataProviderType` mapping instead of
    providers doing it in the other direction.
    Recommendation going into planning: (b) — it matches the existing pattern where
    `sourceOwnership()` already owns exactly this join, and removes the import entirely rather than
    widening the exception a second time.

### Finding 2 — `providers/tmdbService.ts` deep-imports `MediaCache` via `../media/media.cache`

**Investigated against the graph — this is a module-placement problem, not an import-path
problem.** `graphify explain "MediaCache"` shows `MediaCache` (`server/modules/media/media.cache.ts`)
has exactly two non-test importers: `media.handler.ts` (media-domain, expected) and
`tmdbService.ts` (this finding) — `settings.handler.ts` is **not** among them; a first pass at this
spec wrongly assumed it was. `settings.handler.ts` instead receives an `invalidateMediaCaches`
callback, constructed from `mediaHandlers.invalidateMediaCaches` and passed in by
`server/modules/index.ts` when it wires `createSettingsRoutes(cradle, invalidateMediaCaches)` —
proper dependency inversion, not a module import, so settings never actually crosses the
providers/media boundary here. The finding is narrower than first written: only `tmdbService.ts`
deep-imports `MediaCache` directly.

`MediaCache<T>` itself (`server/modules/media/media.cache.ts`) is a generic, TTL-based, in-memory
cache with zero media domain knowledge — no `MediaItem`, no `ContentType`, nothing media-specific
in its implementation or its two real consumers' usage of it. A domain-agnostic utility needed by
more than one module is exactly what `server/kernel/` exists for, per the North Star doc's
definition: "true infrastructure with no domain meaning."

- **Decision: move `MediaCache` to `server/kernel/`.** This resolves the finding without widening
  any module's exception list. Update its two consumers (`media.handler.ts`, `tmdbService.ts`) to
  import from `@server/kernel` instead of a same-module or cross-module relative path.

### Finding 3 — `mediaQueries.handler.ts` deep-imports `MediaQueryEngine`

**Investigated — trivial, no design question.** `server/modules/media/index.ts` already exports
`MediaQueryEngine` (line: `export { MediaQueryEngine, matchItems } from './mediaQueryEngine';`).
The deep import (`@server/modules/media/mediaQueryEngine`) has no reason to exist.

- **Decision: change the import to `@server/modules/media`.** One-line fix, no redesign, no doc
  change — this is exactly the kind of thing an import-boundary lint rule should catch mechanically
  once Phase 8 ships, so it's worth confirming no other module has the same one-line miss before
  calling this class of finding closed (a quick repo-wide grep for `@server/modules/*/[a-zA-Z]` deep
  imports where the target module's `index.ts` already re-exports the same symbol, rather than a
  file-by-file review).

## Testing Decisions

- All three fixes are behavior-preserving refactors (import path changes, a file relocation, and a
  doc clarification) — no new test coverage is needed for the changes themselves, per this
  project's existing "Ground rules (every phase)" convention (`docs/in_progress/README.md`):
  behavior-preserving phases are gated by the existing suite, not new tests.
- Seam: the existing suite is the seam — `yarn test`, `yarn typecheck:server`,
  `yarn typecheck:client`, `yarn lint`, run green before and after, same as every prior North Star
  phase. No new seam needed; this is a pure relocation/import-path change, and the highest existing
  seam (the full suite) already exercises every touched file's behavior indirectly through the
  provider connection tests, `media.cache.test.ts`, and the mediaQueries integration tests.
- `media.cache.test.ts` (`server/__tests__/modules/media/media.cache.test.ts`) moves with the file
  to a kernel test location, consistent with how Phase 2 moved kernel-owned tests to
  `server/__tests__/kernel/`.

## Out of Scope

- Actually building Phase 8's automated import-boundary enforcement check — this spec only clears
  the violations it would immediately trip over. Phase 8 itself stays a separate, later effort.
- Re-litigating the sanctioned `providers → media` exception's *other* existing use
  (`mediaSource.ts`/`roles.ts` referencing `MediaItem` at the contract level) — that part of the
  review came back clean and isn't touched here.
- The `routes` KVP refactor in `server/modules/index.ts` (commit `89fe95c`) — unrelated to the
  import-boundary findings; the developer confirmed it was a deliberate magic-string cleanup, not
  something surfaced by review.
- Deciding finding 1's `ContentType` question (option (a) vs (b)) — flagged as a real open decision
  for whoever picks up the resulting phase, not resolved in this spec.

## Further Notes

- This spec was produced from a code-review pass (Standards axis) on `git diff 520a3ce...HEAD`,
  cross-checked against the actual source (not just the diff) to determine which findings were real
  violations versus artifacts of TypeScript's structural typing requirements. The Spec axis of the
  same review found zero issues with Phases 0–7 against `docs/in_progress/README.md` — this
  document only concerns the Standards-axis findings.
- No hosted issue tracker is configured for this repo (see `CLAUDE.local.md`); this spec is
  published as a file under `docs/plans/` rather than to a tracker. When picked up, it should become
  a proper `docs/in_progress/` phase (or a subsection of Phase 8) following the same ground rules as
  Phases 0–7.
- `docs/plans/` is `.graphifyignore`d alongside `docs/intent/` and `docs/in_progress/` — it's a
  plan, not fact, and this file carries no `ref:path:` links for that reason (a link from a doc the
  graph never ingests would be dead weight, not documentation).
- **Graph implication for Phase 8's doc-promotion step:** when `docs/intent/server-architecture-north-star.md`
  moves to `docs/architecture/` (Phase 8's closing step), it should not be ported as-is. Every other
  `docs/architecture/` doc earns its graph edges by naming the concrete symbols and files it
  documents (see `fracture-ledger.md`'s `ref:path:` links into `roles.ts`, `mediaSourceFactory.ts`,
  etc.) — the North Star doc as currently written names modules and directories in prose, not the
  concrete `index.ts`/`.registrations.ts` files each converged module actually shipped. Promoting it
  means rewriting it as system design documentation with a `ref:path:` link to every module's
  `index.ts` (its crafted public interface), every `.registrations.ts`, and `server/kernel/` itself
  — at which point the promoted doc becomes exactly the kind of high-degree hub node
  (`graphify explain` calls this a "god node") the rest of the module docs, the fracture ledger, and
  every module's own doc should point back to, rather than a plan doc with no incoming edges.
