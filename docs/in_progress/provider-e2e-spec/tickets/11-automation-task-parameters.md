---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: null
blocked_by: []
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Automation task parameters — decision

## Question

`AutomationBuilder` (`src/components/AutomationBuilder/index.tsx`) has no UI for task parameters
today: task selection is a plain id/label radio list, and `handleSubmit` never collects or sends a
`parameterValue`. Yet `useProviderTasks.ts` already types `parameter?: { label: string }` on a task,
and at least one already-wired task (Jellyfin's `addToCollection`) already requires one via
`requireParameter()` at the provider layer — meaning that task cannot actually be selected as a
working automation today; the gap is pre-existing, not introduced by this map.

Several tickets in this map's frontier decide new tasks that also need a parameter value at
automation-creation time: Jellyfin's `removeFromCollection` (collection id), Radarr's `moveMovie`
(target root folder), Sonarr's `changeLanguageProfile` (language profile id), and several of
Overseerr's request/issue tasks (e.g. issue comment text). Rather than each provider's UI ticket
inventing its own one-off parameter-input treatment, decide once, here: how should
`AutomationBuilder` collect a task's parameter value?

Questions to resolve (`/grilling`, `/domain-modeling`):

- Where does the parameter's value come from — free text, a provider-fetched option list (e.g.
  Jellyfin's collections, Radarr's root folders, Sonarr's language profiles), or does it vary by
  task (and if so, what's the small set of parameter *shapes* — free text vs. single-select from a
  fetched list — that covers every task this map has decided so far)?
- Does `useProviderTasks.ts`'s `parameter?: { label: string }` need to grow a `type`/`optionsSource`
  field to describe which shape a given task needs, or does the builder infer it from the task id?
  If new fields are needed, confirm they fit inside the existing `AutomationTask`-shaped response
  from the provider's `.tasks()` declaration (no schema/table change expected — this task metadata
  already flows through the same channel as `label`/`destructive`) rather than needing a new backend
  surface.
- Where does `handleSubmit` place the collected value, and does `CreateAutomationInput` need a new
  field to carry it through to the stored automation and its scheduled run?
- Prototype (`/prototype`) the resulting parameter-input control(s), then run an `impeccable` pass.

## Assets

- [specs/_automation-parameters.md](../specs/_automation-parameters.md) — resulting UI/data-shape
  decision, linked prototype artifacts.

## Blocks

Any provider UI ticket whose decision ticket chose a task requiring a parameter should link here
rather than design its own parameter input: `02-jellyfin-ui` (`removeFromCollection`), `03-radarr-ui`
(`moveMovie`), `04-sonarr-ui` (`changeLanguageProfile`), `06-overseerr-ui` (several). Those tickets
are not blocked by this one at the tracker level — they can still resolve their non-parameterized
fields/tasks — but must defer the parameterized task's automation-UI decision to this ticket's
resolution rather than inventing one in place.

### Parameter shapes recorded by deferring tickets

- **Radarr's `moveMovie`** (from `03-radarr-ui`): single-select, sourced from Radarr's configured
  root folders — a provider-fetched option list (via the already-fetched-but-previously-unused
  `getRootFolders()`), not free text. Same "single-select from a fetched list" shape as Jellyfin's
  `removeFromCollection`, different source list.
- **Sonarr's `moveSeries`** (from `04-sonarr-ui`): single-select, sourced from Sonarr's configured
  root folders via `getRootFolders()` — same shape and same fetch method family as Radarr's
  `moveMovie` above, Sonarr's own instance's root folders as the source list.
- **Sonarr's `changeLanguageProfile`** (from `04-sonarr-ui`): single-select, sourced from a new
  `getLanguageProfiles()` fetch method (mirrors the existing `getProfiles()` used for
  `changeQualityProfile`) — instance-scoped, same "single-select from a fetched list" shape as
  `changeQualityProfile`'s parameter, different source list (language profiles, not quality
  profiles).
- **Overseerr's `Update request`** (from `06-overseerr-ui`): **multi-field**, not single-select —
  the first parameter shape in this map that isn't one dropdown. Needs season selection (which
  seasons to request — itself potentially multi-valued, not a scalar), quality profile (single-select
  from a fetched list, same sub-shape as `changeQualityProfile`), and routing (server/root-folder/
  language-profile, several more single-selects). Whatever `AutomationBuilder` lands on for a
  parameter's shape needs to accommodate a *form* of several inputs collected together and submitted
  as one structured value, not a single id. If the resolution ends up being "one parameter per task,"
  this task alone means that parameter's `type` can't be limited to a scalar id/string — it needs a
  composite/object shape, or `Update request` needs to be modeled as multiple independent parameters
  collected at once.
- **Overseerr's `Add issue comment`** (from `06-overseerr-ui`): **free text**, not a fetched option
  list at all — the parameter value is an arbitrary user-typed comment message (a textarea), sourced
  from nothing on the backend. Every prior entry in this section assumed "value comes from a
  provider-fetched list"; this is the first case where the answer to that ticket's own "free text vs.
  fetched list" question is free text. Confirms both branches of that original question are actually
  needed, not just the fetched-list one every earlier task happened to use.
- **Overseerr's `Override media availability status`** (from `06-overseerr-ui`): **multi-field** —
  a required status value (single-select from a small fixed enum, not fetched — Overseerr's own
  `MediaInfo.status` vocabulary) plus an optional `is4k` boolean flag. Smaller than `Update request`'s
  multi-field shape (two inputs, not three-plus, and one is fixed-enum rather than fetched) but still
  not a single scalar — same composite-value consequence for whatever shape decision gets made.
