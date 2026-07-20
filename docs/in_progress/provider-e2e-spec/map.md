---
type: wayfinder-map
label: wayfinder:map
status: open
---

# Provider E2E Spec — Map

## Destination

A full end-to-end handoff spec, **one markdown file per provider**, under
`docs/in_progress/provider-e2e-spec/specs/<provider>.md`. Each file covers everything needed to
implement that provider completely: database/config surface, provider fields (mapped to domain
field names, with naming-collision notes), UI filters, query-engine wiring, enrichment wiring,
tasks (`MediaActuator` actions), and the automation options those tasks expose. A final
cross-provider doc (`specs/_precedence.md`) resolves field-name collisions across providers (e.g.
Plex's `added` = downloadedAt-to-library vs Radarr's `added` = addedAt-to-source) before anything
merges into `contestedFieldPrecedence`. This map's tickets produce **the spec only** — implementing
against it is a separate, later effort (`/tdd` or `/plan-and-go`).

## Notes

- **Domain:** media provider integrations. In scope — all 10 `MetadataProviderType` enum values
  (`server/database/schema.ts`): Plex, Jellyfin, Radarr, Sonarr, Tautulli, Overseerr, Seerr, TMDB,
  OMDB, TVMaze. ("Available" = currently configurable per the schema enum, whether or not a
  `metadata_provider` row exists yet — this is why Seerr and TVMaze are included even though
  `PROVIDER_REGISTRY` in `src/lib/provider-registry.ts` only lists 8 of the 10.)
- **Tasks = automations.** A provider's `MediaActuator` actions (exposed via its own API) are the
  building blocks the Automations UI offers as options — not a separate track. Spec "tasks" and
  "automation" together in the same ticket.
- **Schema is a blocker, not a decision.** If a provider's spec needs a *structural* schema change
  (new column, new table — not just a new config value stored in the existing `settings` JSON
  blob), flag it and raise it to the user. Do not decide the shape in-ticket.
- **Starting references** (partial gap analysis already exists for some providers — verify and
  extend, don't take as complete): `docs/architecture/media-providers.md`,
  `docs/architecture/media-field-provider-role.md`, `docs/architecture/provider-roles-and-identity.md`,
  `server/modules/media/filterRegistry.ts` (`contestedFieldPrecedence`, `sourceProviders`),
  `src/lib/provider-registry.ts` (`PROVIDER_REGISTRY`), `server/database/schema.ts`
  (`MetadataProviderType`).
- **Skills per ticket type:** research tickets — `WebSearch`/`WebFetch` against the provider's
  official API docs, plus a codebase audit; no other skill mandated. Decision tickets — `/grilling`
  and `/domain-modeling`. UI tickets — `/prototype` first (for any field/task with real UI
  complexity: parameters, filter widget shape), then an `impeccable` pass on the resulting filter UI
  (per field) and automation UI (per task).
- **Ticket sequence per provider:** research → decision → UI pass. UI is blocked on decision;
  decision is blocked on research. The final precedence ticket is blocked on all 10 providers' UI
  tickets.

## Decisions so far

_(none yet — map just charted)_

## Not yet specified

_(none — the per-provider pattern is fully specified and repeatable; nothing left in fog until a
provider's research surfaces something spec-shape-changing)_

## Out of scope

- Implementing the spec (writing enrichers, actuators, UI code, migrations) — this map produces the
  handoff spec only.
