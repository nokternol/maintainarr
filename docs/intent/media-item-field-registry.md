# A `MediaFieldProvider` role for `MediaItem`'s enrichable fields

**Status:** INTENT (future state, not built) — `MediaItem`'s open field shape and derived rule gating,
formerly tracked as open items in `docs/intent/provider-media-identity-model.md` (deleted; fully
extracted here, its own theme). The ids/identity axis (`_sourceIds`, `media_identity`/`media_item`) is
**out of scope here**, already solved — see `docs/architecture/provider-roles-and-identity.md`. This
revises this doc's earlier static-`FIELD_REGISTRY` sketch: a global hardcoded table was the wrong shape
(see "Why not a static global map," below) — the settled direction is a new provider role.

**Not a fracture-ledger item.** The three-way hand-copied field-ownership declaration below
(`movie.ts`/`show.ts`, `ENRICHMENT_POLICY`, `MediaRule.sourceProviders`) is duplication, not a fracture —
`docs/architecture/fracture-ledger.md`'s definition is specifically *competing* systems (more than one
mechanism independently trying to answer the same live question, able to disagree at runtime); three
static copies of one fact that happen to still agree today are a correctness/maintenance risk, not
competition. Recorded here only.

**Not ready for implementation.** This is a design to review, not a phased plan — several questions below
are genuinely unresolved, not just unscheduled. Promote to `docs/in_progress/` only once those are closed
and the design has been through a review pass.

## The role: `MediaFieldProvider`

A fourth role alongside the shipped `MediaSource`/`MediaEnricher`/`MediaActuator` tiers
(`docs/architecture/provider-roles-and-identity.md`) — **media-owned**, like `MediaSource`'s and
`MediaEnricher`'s contracts. `providers/` owns provider *configuration and CRUD* (connections, settings,
instances); `media/` owns all *usage* of what a configured provider produces — the same boundary already
drawn for the other two roles, not a new one. `providers → media` stays a one-way, illegal import
direction throughout; only media-owned adapters bind a provider connection to the role, exactly as
`sourceAdapters.ts`/`enricherAdapters.ts` already do for `MediaSource`/`MediaEnricher`.

**Fields must be defined by the owner, not looked up by name.** A `fields: readonly string[]` property
(this doc's earlier sketch) is wrong: naming a field by string implies its real type is defined
*elsewhere*, reachable by that string key — which is precisely the ownership break this design exists to
close (`EnrichmentResult<TField extends string>`'s same failure, discussed earlier). The owner must
declare the field's actual shape at the point of ownership:

```ts
// media/mediaFieldProvider.ts — illustrative, not reviewed
export interface MediaFieldProvider<TFields extends Record<string, unknown>> {
  readonly fieldShape: TFields; // type-only witness, never constructed with real values
}
```

```ts
// media/enrichment/enricherAdapters.ts — illustrative
export interface TautulliFields {
  playCount: number;
  lastWatchedAt: string;
}
export const tautulliFieldProvider: MediaFieldProvider<TautulliFields> = { fieldShape: null as never };
```

`EnrichableField`/`MediaItem`'s enrichable slice become `keyof` the union of every registered owner's own
declared shape (`TautulliFields & PlexFields & OverseerrFields & TmdbFields & …`), not a lookup against a
shared table. This also buys a real check for free: if two owners both declare `playCount` with
conflicting types, the union fails to compile — TS enforces field-type agreement across owners, which no
version of the string-list sketch could express.

A provider connection can play more than one role at once, same as `RadarrProvider` already playing both
`MediaActuator` (implemented directly on the connection class) and `MediaSource` (bound via
`sourceAdapters.ts`, never implemented directly — a provider connection class never references the media
contract itself). `MediaFieldProvider` follows `MediaSource`'s pattern: a media-owned adapter binds each
provider connection to it, the connection class itself stays unaware of the role. Concretely: Radarr's
adapter also declares `MediaFieldProvider<{ title, tags, qualityProfileId, … }>`; Tautulli/Plex/Overseerr/
TMDB's enricher adapters declare `MediaFieldProvider<{ playCount, lastWatchedAt, … }>`/etc. Source fields
and enrichment fields don't need separate mechanisms — they're the same role, bound by different adapters.

**Why this and not a static global map.** A hardcoded table (`FIELD_REGISTRY = { playCount: { owners:
[TAUTULLI, PLEX] } }`) is exactly `ENRICHMENT_POLICY` relocated — still a location that can drift from
what `mappers.ts` actually sets, and (per the correction above) still names fields by string rather than
defining them at the owner. Declaring the field's real shape on the provider itself, next to the mapper
that produces it, closes both problems at once.

## Related, deferred, not part of this design

Group resolution (`resolveGroup`, shipped) is find-or-create only — it never auto-merges two existing
`media_identity` groups, so a fallback-chain miss (no primary id, title/year collision) can leave two
groups that should be one. A manual-correction layer for mis-resolved groups is out of scope until
duplicate/failed groups actually accumulate enough to need one; the surrogate-id/match-key separation
the shipped model already has exists precisely so that layer can be added later without a rewrite. Loosely
related to this doc (both touch how `MediaItem`/group data is shaped), but not blocking or blocked by it.

## Open design problem: precedence is a cross-owner relation, not a per-owner fact

Field *type* can be defined entirely by one owner (above). Field *precedence* can't — `playCount` is
legitimately owned by both Tautulli and Plex, and today's `ENRICHMENT_POLICY` states Tautulli wins (it
tracks completed plays, not opens). That ranking is a relationship *between* two owners of the same
field, so it cannot live on either owner's own declaration alone the way `fieldShape` does — some
mechanism still has to exist that knows, for a field with more than one declared owner, which one wins.
`mappers.ts`/`resolvePrecedence` currently own this outright; this design directly impacts that ownership
and needs its own careful pass — likely a fairly high number of unit tests, since precedence bugs are
silent (wrong data, not a crash). Not solved here; flagged as the design's hardest remaining problem,
deliberately not resolved by the `fieldShape` mechanism above.

## The active field set: computed once, not re-derived per consumer

Today, `GET /api/filter-fields`'s `gatedDescriptors` intersects `MediaRule.sourceProviders` against
`configuredTypes` on every request. Once field ownership has one real declaration, gating can read it
once instead of re-intersecting: compute the **active field set** — the union of `.fields` from every
currently-configured provider implementing `MediaFieldProvider` — exactly once, triggered on provider
config change (the same event `assertNoActiveConflict` already reacts to), cache it, and have
`gatedDescriptors` read that cached value instead of recomputing. One computation, one cache invalidation
trigger, every consumer reads the same answer.

**Decided: "active" means *provider configured*, nothing else — this is all filter inclusion needs
today, matching current behavior exactly.** Whether a field has actually been observed populated (data
presence) is a **separate concern this design does not take on**, deliberately. It is not just an
additional check — a provider can have data, then be disabled; an enrichment pass can complete but the
enrichment source system can lack the data for a given item for its own reasons; "has an enrichment cycle
completed since this provider was configured" is a real question with no cheap answer today. Solving it
requires its own investigation into what signal is trustworthy and where it's tracked, independent of
this role/registry design. If it's ever tackled, it composes *on top of* the active field set computed
here (a stricter filter over the same base), not instead of it — so nothing here needs to change to leave
room for it later; it's just not part of this scope.

## Scope of alteration (for review sizing, not a ticket breakdown)

| Area | Change |
|---|---|
| `media/mediaFieldProvider.ts` (new) | `MediaFieldProvider<TFields>` interface + `isMediaFieldProvider` — media-owned |
| `enrichment/enricherAdapters.ts`, `media/sourceAdapters.ts` | Each adapter also implements `MediaFieldProvider`, declaring its provider's owned field shape inline |
| `enrichment/precedence.ts` | `ENRICHMENT_POLICY`'s per-field type/owner duplication is removed; precedence *ordering* itself still needs a home — see "Open design problem" above, not resolved by this table |
| `movie.ts`/`show.ts` | Enrichable field block becomes derived from the union of all `MediaFieldProvider` declared shapes, not hand-listed |
| `enrichment/enricher.ts` | `EnrichableField` becomes derived from the same union; `EnrichmentResult<TField>` becomes a checkable claim against a real declaration |
| `media.filterFields.handler.ts` | `gatedDescriptors` reads the cached active field set instead of intersecting `sourceProviders`/`configuredTypes` per request |
| `filterRegistry.ts` | Enrichment-backed `MediaRule.sourceProviders` derived from the active field set for the field each rule's predicate reads |
| Provider config change path (`providerSettingsService`) | Gains the active-field-set cache invalidation trigger |
| Client (`MediaFilterBar`, `useMediaRules`, `useMediaFilters`) | **No change** — see below |
| `automationExecutor` | **No change expected**, needs confirming during implementation (consumes predicate results/identity ids, not field ownership directly) |

## What this does *not* solve — guardrails against reintroducing the duplication

- **`MediaRule`'s predicate/label/dataType authorship stays manual.** A field's existence is derivable
  from `MediaFieldProvider`; *how a filter for it behaves* (predicate logic, UI label, control type) is a
  human decision `MediaFieldProvider` can't produce. Deriving `sourceProviders` from the active field set
  closes the ownership duplication; it doesn't and shouldn't try to auto-generate rules from field
  declarations — that would be a different, riskier design (implicit UI from data shape) than what's being
  proposed here.
- **Precedence ordering needs a design pass of its own** — see "Open design problem" above. This is the
  one place the guardrail isn't "don't reintroduce the old problem," it's "this problem isn't solved yet."
- **Data presence stays explicitly out of scope, not implicitly deferred.** Nothing in this design should
  grow a partial, ad hoc data-presence check later without that being its own reviewed decision — see
  above.

## Client and API layer adjustment

**Client: no change.** `useMediaRules`/`MediaFilterBar` already consume `MediaRuleDescriptor[]` generically
and render whatever arrives — the "client derives, never re-declares" property the Filter/rule vocabulary
fracture (`docs/architecture/fracture-ledger.md`, healed Phase 4) already established. This design changes
*what determines* which descriptors the server sends, not the wire shape or the client's consumption
pattern.

**API: `GET /api/filter-fields`'s response shape is unchanged** (`MediaRuleDescriptor[]`, still
provider-gated from the client's point of view). Only `gatedDescriptors`'s internal gating source changes,
from a live per-request intersection to a read of the cached active field set.

## Remaining open questions before this can move to `docs/in_progress/`

1. **Precedence ordering's design** — the hard problem. Needs its own pass and a fairly high number of
   unit tests, since `mappers.ts`/`resolvePrecedence` currently own this outright and this design directly
   impacts that ownership (see "Open design problem," above).
2. Whether `.fieldShape`'s consistency with what a provider's mapper actually sets needs an explicit test,
   or whether sharing one type parameter across `MediaFieldProvider<TFields>` and `MediaEnricher<TFields>`
   gives enough compiler pressure on its own.
3. Whether instance-scoping (`instanceScoped`-style, shipped for `tagIds`/`qualityProfileIds` in the
   multi-instance model) needs to be expressed per-field here too, or stays a separate concern.

**Decided, not open:** `MediaFieldProvider` is media-owned, mirroring `MediaSource`/`MediaEnricher`
(providers own configuration/CRUD, media owns usage — not a new boundary, the existing one). Fields are
defined by their owner directly (a concrete TS shape), never referenced by string name. Field-inclusion
signal is provider-configured only; data presence is a separate, future, independently-scoped concern
(see "The active field set," above).
