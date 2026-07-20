---
type: wayfinder-spec
label: wayfinder:spec
provider: overseerr
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/06-overseerr-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/overseerr.md
---

# Overseerr — E2E spec

Overseerr is the real build target of this spec (the user's live instance today). Seerr shares this
same implementation once wired — see [`specs/seerr.md`](seerr.md) for what that sharing means and what
stays deferred until upgrade/verification.

## Fields already wired (unchanged baseline)

| Domain field | Source | Flow |
|---|---|---|
| `overseerrRequestStatus` | `MediaRequest.status` (1/2/3 = pending/approved/declined) | `overseerrProvider.ts` → `mediaFieldProvider.ts` (`overseerrFieldProvider`) → `enricherAdapters.ts` (`overseerrEnricher`) → `filterRegistry.ts` (numeric-equality filter) → `activeFieldSet.ts` |
| `overseerrHasIssue` | Presence of any `Issue` on a title (boolean, collapses type/count) | Same chain as above; boolean predicate in `filterRegistry.ts` |

## New fields to wire

All new fields follow the existing `overseerr`-prefix naming convention. Flow for every row below is
the same shape as the two baseline fields: provider read (`overseerrProvider.ts`) → field provider
(`mediaFieldProvider.ts`, `overseerrFieldProvider`) → enrichment (`enricherAdapters.ts`,
`overseerrEnricher`) → filter (`filterRegistry.ts`) → `activeFieldSet.ts`.

| Domain field | Source | Notes |
|---|---|---|
| `overseerrRequestedAt` | `MediaRequest.createdAt` | Enables "requests pending longer than N days" filter. |
| `overseerrRequestedBy` | `MediaRequest.requestedBy` (User) | Store as user identifier/display name, not the full `User` object. UI filter: "requested by user X". |
| `overseerrModifiedBy` | `MediaRequest.modifiedBy` (User \| string, nullable) | Who approved/declined the request. Audit field, not primarily a filter target. |
| `overseerrRequestId` | `MediaRequest.id` | Task-target only — not a UI filter/column. Required so actuator tasks (approve/decline/etc.) have something to act on. |
| `overseerrServerId` / `overseerrProfileId` / `overseerrRootFolder` / `overseerrLanguageProfileId` | `MediaRequest.{serverId,profileId,rootFolder,languageProfileId}` | Sonarr/Radarr routing config carried on the request. Config-surface fields, not filterable — expose as read-only detail, not a filter widget. |
| `overseerrIssueType` | `Issue.issueType` (undocumented locally, but present: video/audio/subtitle/other) | Single scalar per title (most-recent/most-severe issue), same shape as the existing `overseerrHasIssue` boolean just richer. Does **not** attempt to represent multiple simultaneous issue types on one title — see Known limitations. |
| `overseerrIssueStatus` | `Issue.status` (undocumented in the published schema but live in the API; 1=open, 2=resolved observed) | Replaces the pure-presence `overseerrHasIssue` with an open/resolved distinction. Treat the codebase's live runtime read as authoritative over the published schema doc, per research finding. |
| `overseerrIssueCreatedBy` / `overseerrIssueModifiedBy` | `Issue.createdBy` / `Issue.modifiedBy` (User) | Who filed / last touched the issue. Audit fields. |
| `overseerrHasComments` | Presence of any `IssueComment` on an issue | Presence-only boolean, same shape as `overseerrHasIssue` today. No per-comment record is surfaced — see Known limitations. |
| `overseerrRequestScope` | Derived from `MediaRequest.seasons` (`"all"` vs a season-number array) | Coarse scalar: `"all"` or `"partial"`. Not full per-season detail — see Known limitations. |

## Tasks / automation options (`MediaActuator`)

Modeled after the existing `RadarrProvider.tasks()` shape (`id`, `label`, `destructive`, `affects`,
`run`). Overseerr currently has no `MediaActuator` at all — this is a new implementation.

| Task | Endpoint | Destructive | User-facing description |
|---|---|---|---|
| Approve request | `POST /request/{id}/approve` | No | "Approve this pending request." |
| Decline request | `POST /request/{id}/decline` | No | "Decline this pending request." |
| Retry failed request | `POST /request/{id}/retry` | No | "Resend a failed request to Sonarr/Radarr." |
| Delete request | `DELETE /request/{id}` | Yes | "Permanently remove this request." |
| Update request | `PUT /request/{id}` | No | "Change season selection, quality profile, or routing on an existing request." Parameterized — needs a task-parameter UI (per map's UI-ticket guidance), not a single-click action. |
| Resolve issue | `POST /issue/{id}/resolved` | No | "Mark this issue as resolved." |
| Reopen issue | `POST /issue/{id}/open` | No | "Reopen a previously resolved issue." |
| Delete issue | `DELETE /issue/{id}` | Yes | "Permanently remove this issue." |
| Add issue comment | `POST /issue/{id}/comment` | No | "Add a comment to this issue." Parameterized (free-text message). |
| Override media availability status | `POST /media/{id}/{status}` | No (admin-only manual override) | "Manually set this title's availability status." Parameterized (status + optional `is4k`). Mutates `MediaInfo.status` — a different enum than `overseerrRequestStatus`, disambiguate in UI copy. |

**Dropped from this pass:** Delete issue comment (`DELETE /issueComment/{id}`) — requires a specific
comment ID, and no comment records are surfaced anywhere (`overseerrHasComments` is presence-only).
Revisit only if/when comment records get a real listing.

## Known limitations (accepted, not built this pass)

- **4K/non-4K request duality**: a title can carry both a 4K and non-4K `MediaRequest` simultaneously.
  `overseerrFieldProvider.visit`'s tmdbId-keyed collapsing keeps only the last-seen request, silently
  dropping the other side's status. Stays as-is; documented as a known gap. Fixing it needs a compound
  key (tmdbId+is4k) or a second parallel field pair — a structural schema change, out of scope here.
- **Issue-type breakdown is single-valued**: `overseerrIssueType` represents one issue's type per
  title, not simultaneous multiple types (e.g. a title with both a video issue and a subtitle issue
  open at once). True multi-type support needs a structural schema change.
- **`overseerrHasComments` is presence-only**: no per-comment records (author, message, id) are
  surfaced. Full comment listing needs a new child table — deferred.
- **`overseerrRequestScope` is coarse**: `"all"` vs `"partial"`, not which specific seasons were
  requested. Full per-season detail needs a new child table (season detail lives on child
  `SeasonRequest` objects, inherently multi-valued per request) — deferred.
- **`OverseerrRequest.type` field mismatch**: the codebase's local interface declares a `type: string`
  field that does not appear in the current official `MediaRequest` OpenAPI schema. Not spec'd or
  wired until verified against a live instance — may be stale/vestigial, or upstream may have changed
  the schema since the interface was written.

## Out of scope

- **User-management endpoints** (`/user/*`, permissions, quotas, watchlist import) — user
  administration, not a media-item field/filter/task.
- **Notification-config endpoints** (`/settings/notifications/*`) — Overseerr's own outbound
  notification config, not media data.
- Both excluded per the standing rule: an API surface that doesn't map to a collection of media items
  is not a task for this product.

## Naming-collision notes (for the final precedence ticket — not resolved here)

- **`status`** is heavily overloaded: `overseerrRequestStatus` (request approval state, 1/2/3),
  `MediaInfo.status` (media availability, 1-6 — not yet wired, would need its own prefixed name e.g.
  `overseerrMediaStatus` if the "override media availability" task's read side is ever surfaced as a
  filter), `overseerrIssueStatus` (open/resolved, new in this spec), and `tmdbStatus` (TMDB's release
  state — already live). Four semantically distinct "status" fields; UI copy must disambiguate,
  especially since a UI filter literally labeled "Status" is a plausible target for any of them.
- **`overseerrRequestedBy`** — generic enough in spirit to later collide with Plex's `added`/
  `plexAddedAt` (downloaded-to-library timestamp) or a future arr-stack "added by" field, if
  per-user attribution is ever wired elsewhere. Flag only, no current literal name collision.
- **`overseerrRequestId`** — pure join/task-target key, not filterable, but should be reconciled with
  TMDB's `tmdbId` as the canonical identity field if request-level identity is ever surfaced directly.

## Filter type mapping

`overseerrRequestStatus` and `overseerrHasIssue` are already wired (see baseline table above) and are
not revisited here. Mapping below covers only the new fields from this spec that are meant to be
independently filterable; fields already noted above as audit-only, task-target-only, or config-surface
(`overseerrModifiedBy`, `overseerrRequestId`, `overseerrServerId`/`overseerrProfileId`/
`overseerrRootFolder`/`overseerrLanguageProfileId`, `overseerrIssueCreatedBy`/
`overseerrIssueModifiedBy`) are excluded, not mapped to a dataType.

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `overseerrRequestedAt` | `overseerrRequestedDaysAgo` | `range` | Date-shaped; follows the `addedDaysAgo`/`plexAddedDaysAgo` days-ago convention, not a raw date picker. Directly enables the spec's stated "pending longer than N days" use case. |
| `overseerrRequestedBy` | `overseerrRequestedBy` | `string` | Spec explicitly calls for "requested by user X" — single-value match against the stored user identifier/display name. |
| `overseerrIssueType` | `overseerrIssueType` | `csv-strings` | Small fixed value set (video/audio/subtitle/other); multi-select ("video OR subtitle issues") is a natural fit, same shape as `certification`/`genres`. |
| `overseerrIssueStatus` | `overseerrIssueStatus` | `number` | Mirrors the already-wired `overseerrRequestStatus` rule exactly — small numeric enum (1=open, 2=resolved) modeled as single-value numeric-equality, per that existing precedent. |
| `overseerrHasComments` | `overseerrHasComments` | `boolean` | Presence-only, same shape as the already-wired `overseerrHasIssue` boolean rule. |
| `overseerrRequestScope` | `overseerrRequestScope` | `string` | Coarse two-value scalar (`"all"` / `"partial"`); spec gives no multi-select ("all OR partial") use case, so single-value exact-match rather than `csv-strings`. |

Fields intentionally not mapped (no dataType — not independently filterable): `overseerrModifiedBy`,
`overseerrRequestId`, `overseerrServerId`, `overseerrProfileId`, `overseerrRootFolder`,
`overseerrLanguageProfileId`, `overseerrIssueCreatedBy`, `overseerrIssueModifiedBy` — per the spec's own
notes above, these are audit-only, task-target-only, or config-surface display fields.

### Tasks (automation options)

| Task | Parameter shape |
|---|---|
| Approve request | none |
| Decline request | none |
| Retry failed request | none |
| Delete request | none |
| Update request | multi-field (season selection, quality profile, routing) |
| Resolve issue | none |
| Reopen issue | none |
| Delete issue | none |
| Add issue comment | free-text |
| Override media availability status | multi-field (status + optional `is4k`) |
