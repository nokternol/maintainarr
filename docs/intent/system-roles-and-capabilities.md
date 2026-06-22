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
membership, the canonical-`MediaItem` shared model) is `docs/architecture/media-enricher-role.md`.

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
class PlexProvider   implements MediaEnricher, MediaActuator { … }
```

One runtime object per system — the roles share the system's HTTP client and auth, so splitting into
separate Source/Enricher/Actuator services would only duplicate that wiring. **Role membership is declared
and type-checked, not duck-typed:** `server/providers/roles.ts` declares `MediaSource` / `MediaEnricher` /
`MediaActuator` as real contracts a class `implements`, and `BaseProviderConnection` is an
HTTP-client+config base with no role contract. Membership is no longer inferred from which methods a class
happens to expose or which string-keyed dispatch table mentions it — the contract is the node, and a
behavioral method (`enrich(items)`, `tasks()`) is its edge to the providers that hold it.

`MediaActuator` is where **tasks** live. Tasks are the public action surface of the actuator role —
**not a property every provider has.** A system without the actuator role has no tasks, by
construction; the UI cannot offer one.

## The actuator role owns its tasks, gated per instance (built server-side)

The server is the only place that can *honor* the contract (only it can execute a task), so the server
owns the truth — and it owns it **on the configured instance, not a type-keyed table**. As built
(`docs/architecture/actuator-task-ownership.md`):

- **`MediaActuator` exposes `tasks(): ActuatorTask[]`.** Each task is a descriptor (`id`, `label`,
  `destructive`, `affects?`) plus a runner **bound to the concrete instance** — no cast. The role is the
  sole authority for what tasks exist; a system without the role has no tasks, by construction.
- **The whole vocabulary is modelled now** as parameterless tasks: real (instance-bound) where runnable
  today, otherwise a modelled task whose `run` throws via `modelledRun`, disabled by default.
- **Enablement is per instance** (`provider.settings.enabledTasks`, default off), read by the single
  authority `readEnabledTaskIds`, and **enforced at both `automationService.create` and the executor's
  run** — not the UI. An unrunnable or disabled task can neither be persisted nor executed.
- **Discovery is instance-keyed:** `GET /api/providers/tasks` returns, per configured actuator instance,
  `{ providerId, type, tasks: [{…descriptor, enabled}] }`; non-actuators are absent.

The role on the instance is the only server-side declaration of a task. The remaining duplicate is the
**client** catalogue (`src/lib/provider-registry.ts` `tasks`, `src/lib/tasks.ts`): the right instinct on
the wrong side of the boundary. Stage 2 makes it a projection of the instance-keyed API and deletes it;
until then it is a known stale duplicate, not a second authority.

## Relationship to the other role docs

- **MediaSource** is the role formalised in `docs/intent/provider-source-model.md` (the `media_item` /
  `media_identity` split, instance-not-type keying, logical grouping). That document is the detailed
  spec of *this* role; this document is the umbrella.
- **MediaEnricher** is the role formalised in `docs/architecture/media-enricher-role.md` (behavioral
  `enrich(items)` contract, non-owner membership, the canonical-`MediaItem` as the shared contract). The
  detailed spec of *this* role.
- `docs/architecture/provider-roles-and-identity.md` records the **as-built** Source/Enricher tiering.
- `docs/architecture/actuator-task-ownership.md` records the **as-built** Actuator role: the role owns its
  tasks on the configured instance, per-instance enablement, and instance-keyed discovery that realise it.

## Course-correction sequencing (consequence, not goal)

1. ✅ **Name the roles.** `MediaSource` / `MediaEnricher` / `MediaActuator` interfaces; concrete providers
   `implements` the ones they hold, over the `BaseProviderConnection` HTTP/config base.
2. ✅ **The role owns its tasks** (server). `MediaActuator.tasks()` declares the vocabulary on the
   instance, runner bound (no cast); destructive/affects on the descriptor. The type-keyed manifest is
   retired.
3. ✅ **Enablement per instance** (`settings.enabledTasks`, default off), enforced at `create` **and**
   executor run; instance-keyed discovery.
4. ⬜ **Derive the client registry** from the instance-keyed API; delete the parallel catalogue (Stage 2).
5. ⬜ **Resolve the source/actuator conflation** so a non-source actuator (Plex/Jellyfin/Tautulli) can
   derive ids across the identity graph and actually run.
</content>
</invoke>
