---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [09-seerr-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Seerr — decision

## Question

Using the Seerr research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Seerr's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/seerr.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/seerr.md](../specs/seerr.md) — migration note (not a full parallel spec — see Resolution).

## Resolution

- **Share, don't duplicate**: Seerr routes through the same implementation as Overseerr (same
  enricher, actuator tasks, `overseerr`-prefixed field names) rather than getting independent wiring.
  Decided jointly with `06-overseerr-decision` since the two providers' specs are coupled.
- **`SEERR` is the go-forward type but doesn't replace `OVERSEERR` in the enum** — both stay
  configurable; Overseerr is the actual build target for this pass since that's what the user runs
  today, Seerr is documented as where the provider is headed once the user upgrades.
- **No live compatibility verification performed** — the "share" decision rests on the research
  finding that the three endpoints this codebase calls (`request`/`issue`/`search`) look structurally
  unchanged between Overseerr and the merged Seerr project's spec. Verification against a real Seerr
  instance is deferred to whenever the user's container gets upgraded, not treated as a blocker to
  writing this spec.
- **Seerr-only surfaces deferred**: Jellyfin/Emby auth+user-sync and multi-Plex-server settings are
  explicitly out of scope until upgrade — no design work started on either.
- **Structural schema question (multi-Plex-server settings) raised to the user, not resolved**: noted
  as a possible future gap if confirmed live against the targeted Seerr version, not designed here.
