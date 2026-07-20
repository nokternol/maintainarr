---
type: wayfinder-ticket
label: wayfinder:prototype
status: open
assignee: null
blocked_by: [01-plex-decision]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Plex — UI pass

## Question

For every field Plex's decision ticket chose to wire as a UI filter, and every task chosen to
expose as an automation option: prototype (`/prototype`) any that need real UI thought (parameters,
non-trivial filter widget shape — e.g. a range vs. a multi-select vs. a date picker), then run an
`impeccable` pass on the resulting filter UI (per field) and automation UI (per task). Record the
UI/UX decisions (widget choice, parameter shape, copy) back into
`docs/in_progress/provider-e2e-spec/specs/plex.md`, linking any prototype artifacts rather
than pasting them in.

## Progress

The crowding blocker that sat ahead of this ticket — MediaFilterBar rendering every configured
rule's control unconditionally, which doesn't hold up once Plex's 13 new fields join the ~70-field
total across all providers — is resolved: `ref:src/components/MediaFilterBar/FilterPicker.tsx`
implements the add-filter pattern (see `docs/in_progress/provider-e2e-spec/specs/plex.md`'s new "UI
decisions" section for the full writeup), built directly rather than via a throwaway `/prototype`
per explicit direction, with a partial `impeccable` craft pass (shape brief, design-token
compliance, keyboard nav, viewport-edge positioning). Verified in Ladle, not yet in the
authenticated app shell.

Still open: the per-field widget/parameter-shape decisions for Plex's 13 new fields themselves
(`studio`, `runtimeMinutes`, `fileContainer`, `videoCodec`, `audioCodec`, `fileResolution`,
`fileSizeBytes`, `releaseDaysAgo`, `labels`, plus the two joining-existing-rule fields) — this
ticket's original scope — are unaddressed. Each still needs its own widget-shape decision and
`impeccable` pass once its control is built.
