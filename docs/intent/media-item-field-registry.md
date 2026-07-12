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
close (`EnrichmentResult<TField extends string>`'s same failure, discussed earlier).

**Two distinct shapes, not one, because a real transform sits between them.** A provider's own
representation of a field (`MediaField` — e.g. Tautulli's raw bitfield) is not always the same *type* as
`MediaItem`'s canonical, post-precedence representation of that field (`EnrichmentField` — e.g. a
boolean). Collapsing both into one shared type (`Pick<MediaItem, ...>`, or a single `TFields` checked
against both ends) forces a cast to fake agreement at exactly the point where a real, meaningful
conversion needs to happen — and casts are TypeScript's mechanism for overriding inference, which is the
opposite of what's needed to prove the conversion correct. The two shapes let a genuine value-changing
transform (bitfield → boolean) be modelled and checked on its own terms, so a bug in that transform
surfaces as an ordinary return-type mismatch at the transform itself, not as a silently-accepted cast
somewhere upstream or downstream of it.

`EnrichmentFields` is a single, central, hand-authored, **type-only** mapped type — the canonical
field-name → internal-type dictionary every adapter's output is checked against. It is not a runtime
lookup table (that's exactly the rejected `FIELD_REGISTRY` shape, see below) and it is not derived by
unioning every provider's own declared shape — that union approach was tried and rejected here (see
"Why not derive the canonical type by unioning provider shapes," below). A provider's own `MediaField`
shape needs no central type at all: it's adapter-local, since nobody outside that adapter needs to know
Tautulli represents watched-state as a bitfield.

```ts
// media/mediaFieldProvider.ts — illustrative, not reviewed. Exact file placement follows
// the existing providers/media import-graph rules at implementation time, not fixed here.
export type EnrichmentFields = {
  playCount: number;
  lastWatchedAt?: string;
  // ... one canonical entry per enrichable field, hand-authored
};

export interface MediaFieldProvider<TMediaField, TFields extends Partial<EnrichmentFields>> {
  // Provider's own native shape — adapter-local, no central type.
  visit(raw: unknown[]): Map<string, TMediaField>;
  // Explicit, checked transform: this is where a bitfield->boolean bug would surface
  // as a real type error, not a cast.
  toEnrichmentFields(native: TMediaField): TFields;
}
```

```ts
// media/enrichment/enricherAdapters.ts — illustrative
interface TautulliMediaField {
  watchedBits: number; // Tautulli's own representation
}

export const tautulliFieldProvider: MediaFieldProvider<
  TautulliMediaField,
  Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>
> = {
  visit(history) {
    /* replaces the standalone mapTautulliHistory function — the mapper logic now
       lives on the adapter, alongside the field declaration it produces */
  },
  toEnrichmentFields(native) {
    /* the real, checked transform */
  },
};
```

There is no separate `fieldShape` witness property (an earlier sketch here had one). A prototype
(`docs/plans/media-item-field-registry-ticket-01-fields-mapper-prototype.md`) confirmed it does zero
enforcement work on its own — a type-only property, constructed via an `as unknown as TFields` cast,
checked against nothing. All the real enforcement comes from `visit()`/`toEnrichmentFields()`'s ordinary
declared return types; dropping the redundant, unenforced property removes an attractive nuisance rather
than losing any real check. (Wrapping a `toEnrichmentFields` return in an `as` cast still defeats that
check, same as any TS cast — this is treated as an ordinary, already-understood TS sharp edge, not one
needing a new lint rule, since nothing in today's `mappers.ts` reaches for casts either.)

Because every adapter's output is a `Pick`/`Partial<Pick>` **of the same central `EnrichmentFields`**,
two adapters declaring conflicting types for the same field is not just caught — it's inexpressible. (An
earlier version of this design unioned each adapter's own bespoke shape instead
(`TautulliFields & PlexFields & …`) and relied on the union failing to compile to catch conflicts; the
prototype found that claim true only in the narrow case where a real value is *constructed* at the
conflicting shape — the union itself compiles fine, and a conflicting field collapses silently to
`never` rather than raising a clear error. Checking every adapter against one shared `EnrichmentFields`
instead avoids relying on that narrow case entirely.)

A provider connection can play more than one role at once, same as `RadarrProvider` already playing both
`MediaActuator` (implemented directly on the connection class) and `MediaSource` (bound via
`sourceAdapters.ts`, never implemented directly — a provider connection class never references the media
contract itself). `MediaFieldProvider` follows `MediaSource`'s pattern: a media-owned adapter binds each
provider connection to it, the connection class itself stays unaware of the role. Source fields and
enrichment fields don't need separate mechanisms — they're the same role, bound by different adapters.

**Why this and not a static global map.** A hardcoded table (`FIELD_REGISTRY = { playCount: { owners:
[TAUTULLI, PLEX] } }`) is a *runtime* lookup that can drift from what the adapter's transform actually
sets, and still names fields by string rather than checking them structurally. `EnrichmentFields` is
type-only — it exists purely to constrain `TFields` at compile time, never read or branched on at
runtime — so it doesn't reintroduce the drift risk a runtime table has.

**Why not derive the canonical type by unioning provider shapes.** The original sketch of this design
tried to avoid a central type entirely, letting `EnrichmentFields` (then `EnrichableField`) fall out of
`TautulliFields & PlexFields & …` — every provider owning its field's type outright, nothing central.
This doesn't hold up: a provider's own field type and `MediaItem`'s canonical, post-precedence type for
that field are genuinely different types when a real transform sits between them (the bitfield/boolean
case above), so unioning providers' own shapes was never actually computing the right thing. A central,
hand-authored `EnrichmentFields` was unavoidable — even in a design that set out specifically to avoid
one — because it's needed for type enforcement regardless of who "owns" a field's meaning.

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
| `media/mediaFieldProvider.ts` (new) | `MediaFieldProvider<TMediaField, TFields>` interface, the central `EnrichmentFields` type, + `isMediaFieldProvider` — media-owned |
| `enrichment/enricherAdapters.ts`, `media/sourceAdapters.ts` | Each adapter also implements `MediaFieldProvider`: `visit()` (the mapper logic currently in `enrichment/mappers.ts`, relocated here) plus an explicit `toEnrichmentFields()` transform |
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
2. Whether instance-scoping (`instanceScoped`-style, shipped for `tagIds`/`qualityProfileIds` in the
   multi-instance model) needs to be expressed per-field here too, or stays a separate concern.

**Decided, not open:** `MediaFieldProvider` is media-owned, mirroring `MediaSource`/`MediaEnricher`
(providers own configuration/CRUD, media owns usage — not a new boundary, the existing one). Fields are
defined by their owner directly (a concrete TS shape), never referenced by string name. Field-inclusion
signal is provider-configured only; data presence is a separate, future, independently-scoped concern
(see "The active field set," above). A provider's own field representation (`MediaField`) and `MediaItem`'s
canonical post-precedence representation (`EnrichmentField`) are distinct types with an explicit, checked
transform between them — not one shared type — and the canonical side is checked against one central,
hand-authored, type-only `EnrichmentFields` dictionary rather than derived by unioning every provider's
own declared shape (see "The role: `MediaFieldProvider`," above, for why the union approach doesn't hold
up). There is no separate `fieldShape` witness property; `visit()`/`toEnrichmentFields()`'s ordinary
return types carry all the enforcement. `TFields extends Record<string, unknown>` (this doc's earlier
constraint) is corrected to `TFields extends Partial<EnrichmentFields>`, since `Record<string, unknown>`
rejects any concrete interface lacking an index signature.
