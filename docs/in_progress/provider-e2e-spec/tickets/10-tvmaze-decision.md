---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [10-tvmaze-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Tvmaze — decision

## Question

Using the Tvmaze research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Tvmaze's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/tvmaze.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/tvmaze.md](../specs/tvmaze.md) — full e2e spec.

## Resolution

- **Corrected the research's central premise**: TVMaze is not actually keyless/always-on — it
  requires a real API key (the user's was lost to a database reset, currently unrecoverable due to
  a broken social-login flow on TVMaze's own site). This reverses the research doc's "no config
  needed" framing: TVMaze gets a real `metadata_provider` row, a `PROVIDER_REGISTRY` entry, and is
  folded into the standard `ProviderFactory` contract (`AnyProvider`/`ProviderSet`/`create()`),
  gated by the normal active-provider check like every other provider. No placeholder credentials
  inserted as part of this spec.
- **Headline gap wired**: `network` merged with `webChannel` (fixes the silent-miss bug for
  streaming-exclusive shows), second producer alongside Sonarr.
- **Vocabulary mismatch resolved per-field, not uniformly**: `status` gets mapped onto the existing
  shared vocabulary (same concept, different words); `type` stays separate (`tvmazeType` — a
  genuinely different concept, release-format vs. `seriesType`'s release-cadence axis).
- **`releaseDate` and `runtime` extended to shows for the first time** via TVMaze's `premiered`/
  `averageRuntime` — both were movie-only (or Plex/Jellyfin-only) until now.
- **Ratings explicitly deferred, with a durable-record requirement** — not merely noted in this
  session's conversation. The user flagged that ratings broadly need a dedicated
  `MediaRatingsProvider`-backed architectural pass (separate table, keyed/weighted/computed) rather
  than the shared-EnrichmentFields treatment used elsewhere. Since `docs/in_progress/` is deleted
  once this phase ships, the spec requires a JSDoc note at `TvMazeProvider`'s rating read site (and
  retroactively, TMDB's/OMDB's) so this intent survives past the doc's own deletion.
- **Structural gaps raised and deferred, not designed**: episodes, cast/crew, akas, schedule,
  seasons (including season-level network/webChannel granularity), images/artwork.
- **No tasks** — confirmed empty-by-design, no actuator role is plausible.

## Addendum (full ratings pass, same session)

The user asked for the full ratings pass this ticket flagged the need for. Result:
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md), consolidating
every provider's ratings fields (previously scattered across `specs/radarr.md`, `specs/sonarr.md`,
`specs/plex.md`, `specs/jellyfin.md`, `specs/tmdb.md`, `specs/omdb.md`, plus this ticket's own
deferred `rating.average`) into one inventory with the proposed `MediaRatingsProvider` role. Each
affected spec/ticket now points there instead of carrying its own ratings-field definitions — see
each one's own addendum.
