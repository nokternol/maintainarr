---
type: wayfinder-implementation-map
label: wayfinder:implementation-map
status: open
---

# Provider E2E Spec — Implementation Map

Tracks building the 12 specs in this directory against real code. The specs themselves
(`plex.md`, `jellyfin.md`, ..., `_precedence.md`, `_automation-parameters.md`) are the finished
output of the closed [provider-e2e-spec wayfinder map](../map.md) — this file is a separate
tracker for the "implement it" phase that map's Destination explicitly deferred.

## Front matter convention

Every spec in this directory carries:

```yaml
---
type: wayfinder-spec
label: wayfinder:spec
provider: <name>              # matches the file name; _-prefixed for cross-provider specs
status: draft | implementing | implemented
source_ticket: <path>         # the wayfinder decision ticket this spec was written from
source_research: <path>       # optional; the research ticket behind source_ticket, if any
---
```

`status` is the per-file source of truth for where that spec is in the implementation
lifecycle:

- **`draft`** — spec is finished and reviewed, nothing built against it yet.
- **`implementing`** — an implementation branch and PR are in flight. Find them in the tracker
  table below (frontmatter doesn't carry a branch/PR field — that's tracked centrally here so
  it's not duplicated 12 times).
- **`implemented`** — the PR merged. The spec's content is done; per this repo's docs
  convention (`docs/in_progress/` is deleted once its phase ships), the `docs-lifecycle` skill
  should fold it into `docs/architecture/` and delete it from here, rather than leaving a stale
  `implemented` flag sitting in `in_progress/`.

## Workflow for implementing a spec

1. Branch from `main`: `git checkout main && git pull && git checkout -b <branch>`.
2. Flip that spec's frontmatter `status` to `implementing`, commit, push, open a PR against
   `main`. Fill in the tracker row below with the branch and PR link.
3. The PR description is the report of what was done — update it as work lands rather than
   narrating progress elsewhere. No separate summary doc.
4. Drive the actual build with the `plan-and-go:tdd` skill: invoke it via the Skill tool
   (`skill: "plan-and-go:tdd"`) as the first action, before writing any code — do not just
   apply RED/GREEN/REFACTOR from general knowledge, follow the skill's own instructions once
   loaded. Point it at the spec file and this implementation map.
5. On merge: flip `status` to `implemented`, update the tracker row, and hand off to
   `docs-lifecycle` to move the spec into `docs/architecture/`.

## Tracker

| Spec | Status | Branch | PR |
|---|---|---|---|
| [plex](plex.md) | implementing | `implement/plex-provider-spec` | [#46](https://github.com/nokternol/maintainarr/pull/46) |
| [jellyfin](jellyfin.md) | implementing | `implement/jellyfin-provider-spec` | [#48](https://github.com/nokternol/maintainarr/pull/48) |
| [radarr](radarr.md) | implementing | `implement/radarr-provider-spec` | [#49](https://github.com/nokternol/maintainarr/pull/49) |
| [sonarr](sonarr.md) | draft | — | — |
| [tautulli](tautulli.md) | draft | — | — |
| [overseerr](overseerr.md) | draft | — | — |
| [seerr](seerr.md) | draft | — | — |
| [tmdb](tmdb.md) | draft | — | — |
| [omdb](omdb.md) | draft | — | — |
| [tvmaze](tvmaze.md) | draft | — | — |
| [_automation-parameters](_automation-parameters.md) | draft | — | — |
| [_precedence](_precedence.md) | draft | — | — |

`_automation-parameters` and `_precedence` are cross-cutting; implement them alongside whichever
provider spec first needs the mechanism or precedence rule they define, not standalone.

**Plex is partially done, still `implementing`.** [#46](https://github.com/nokternol/maintainarr/pull/46)
merged every field in its filter-type-mapping table except `genres`/`certification`: the
enrichment pipeline has no mechanism today to keep Radarr/Sonarr's construction-time value from
being overwritten by Plex's enrichment-stored one, so wiring Plex as a producer for those two
fields now would regress existing behavior rather than extend it. Blocked on `_precedence`'s
implementation landing precedence-ordering machinery first — revisit `plex.md`'s `genres`/
`certification` rows once that ships.
