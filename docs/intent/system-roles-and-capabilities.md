# System Roles & Capabilities (target)

**Status:** INTENT (target model, not fully built). The unifying model for how a configured external
system relates to Warden. It generalises the source-vs-provider split
(`docs/intent/provider-source-model.md`) into the full set of roles a system can play, and gives the
**actuator/task** role — the one still fused into "provider" today — an explicit home.

**Read this before adding a provider, a task, or anything that touches the executor.** The recurring
friction this corrects is per-task work treating every external system as interchangeable. It is not.

## The core distinction: a *system* is config; *roles* are capabilities

A configured external system (Radarr, Plex, TMDB, …) is, at root, just **connection
configuration**: a type, a base URL, an API key, settings. That is what the `providers` row and
`ProviderConfig` already are — identity-less credentials, nothing more. The system is **not** the
behaviour.

On top of that config a system plays **up to three independent roles**. Each role is a *capability*
the system either has or does not have — never assumed:

| Role | Responsibility | Hard requirement | Drives |
|---|---|---|---|
| **MediaSource** | Owns a collection of media: defines what *exists* and a canonical id | Stable per-item external id | Catalog rows (`media_item`), browse lists, content types |
| **MediaEnricher** | Contributes metadata about media it does *not* own, joined into the enrichment graph by logical key | A shared logical key (tmdb/tvdb/imdb/…) | Filter predicates, `media_enrichment` |
| **MediaActuator** | Exposes an API to *perform actions* on media | An addressable target + an action endpoint | Tasks, the automation verb |

One system can hold several roles. **Radarr is Source + Actuator**: it owns movies (Source) and offers
unmonitor/search/delete endpoints (Actuator). Its tags, quality profiles, and genres are **Source
fields** on its own rows — *not* enrichment, because enrichment is strictly metadata about media a system
does **not** own. **TMDB is MediaEnricher only.** This multiplicity is exactly why "Provider" as a single
amalgamated concept fails — the roles have different requirements and different consumers, and collapsing
them forces every system to pretend it can do all three. The detailed MediaEnricher spec (contract,
membership, the canonical-`MediaItem` shared model) is `docs/intent/media-enricher-role.md`.

## Capabilities are declared and additive, never assumed

The original model assumed every external system was an equal, all-capable provider, and retracted
capability when a system turned out to lack identifiers. That assume-then-retract shape is the source
of the drift.

The correct shape is the inverse: **a system has a role only when it declares that role.** Consequences:

- A limitation discovered by tripping over it (Plex has no stable catalog id; OMDB has no write API)
  is not a model break — it simply means that system never declared `MediaSource` / `MediaActuator`.
- The model tolerates *partial knowledge of a target system*. You add a role to a system when you
  learn it qualifies; the role interfaces themselves stay stable.
- "Add a provider" becomes "declare which roles this system supports", not "implement everything".

## One class, three role interfaces (not three services)

A concrete provider class implements the role interfaces it qualifies for:

```ts
class RadarrProvider implements MediaSource, MediaActuator { … }
class TmdbProvider   implements MediaEnricher { … }
class PlexProvider   implements MediaEnricher /*, MediaActuator later */ { … }
```

One runtime object per system — the roles share the system's HTTP client and auth, so splitting into
separate Source/Enricher/Actuator services would only duplicate that wiring. What changes from today is
that **role membership is declared and type-checked, not duck-typed.** Today the roles exist only as
conventions: `BaseMetadataProvider` is just an HTTP-client+config base with no role contract, and
membership is inferred from which methods a class happens to expose and which string-keyed dispatch
table happens to mention it. There is no contract to reason about — which is why the roles form no node
or edge in the knowledge graph.

`MediaActuator` is where **tasks** live. Tasks are the public action surface of the actuator role —
**not a property every provider has.** A system without the actuator role has no tasks, by
construction; the UI cannot offer one.

## Server-authoritative capability manifest (single source of truth)

The server is the only place that can *honor* the contract (only it can execute a task), so the server
owns the truth:

- A **server-side manifest per provider type** declares: which roles it holds, and — for actuators —
  its **task vocabulary** (id, label, destructive, what it affects, kind/role gating).
- `automations.taskId` is **validated against the manifest on create/update**. An unrunnable task can
  no longer be persisted. (Today `taskId` is `z.string().min(1)` — any string — so the executor throws
  `Task "…" is not yet implemented` at run time instead.)
- The **client registry derives from the manifest** (fetched or generated), instead of being a parallel
  hand-maintained catalog. The client's existing `filterCapabilities` / `tasks` declaration is the
  right instinct on the wrong side of the boundary; it becomes a projection of the server manifest.

This collapses the two task catalogues — `src/lib/provider-registry.ts` (advertised) and the executor's
`RADARR_TASKS` / `SONARR_TASKS` / `SYSTEM_TASKS` (executable) — into one, so they cannot drift.

## Relationship to the other role docs

- **MediaSource** is the role formalised in `docs/intent/provider-source-model.md` (the `media_item` /
  `media_identity` split, instance-not-type keying, logical grouping). That document is the detailed
  spec of *this* role; this document is the umbrella.
- **MediaEnricher** is the role formalised in `docs/intent/media-enricher-role.md` (behavioral
  `enrich(items)` contract, non-owner membership, the canonical-`MediaItem` shared model that retires
  `EnrichmentContribution`). The detailed spec of *this* role.
- `docs/architecture/provider-roles-and-identity.md` records the **as-built** Source/Enricher tiering.
- `docs/architecture/task-execution-and-actuator-manifest.md` records the **as-built** Actuator role:
  the server task manifest, executor dispatch, and create-time validation that realise it.

## Course-correction sequencing (consequence, not goal)

1. **Name the roles.** Introduce `MediaSource` / `MediaEnricher` / `MediaActuator` interfaces; have
   concrete providers `implements` the ones they hold. Rename `BaseMetadataProvider` to reflect that it
   is a connection/HTTP base, not a metadata contract.
2. **Server task manifest.** Move the task vocabulary server-side as the actuator's declaration; key it
   by provider type; include destructive/affects.
3. **Validate `taskId`** against the manifest on automation create/update.
4. **Derive the client registry** from the manifest; delete the parallel catalogue.
5. **Per-type role audit.** Record each system's declared roles (see the matrix in the as-built doc) and
   stop advertising actuator tasks for systems that hold no actuator capability.
</content>
</invoke>
