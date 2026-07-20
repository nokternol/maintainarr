---
type: wayfinder-ticket
label: wayfinder:prototype
status: open
assignee: null
blocked_by: [04-sonarr-decision]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Sonarr — UI pass

## Question

For every field Sonarr's decision ticket chose to wire as a UI filter, and every task chosen to
expose as an automation option: prototype (`/prototype`) any that need real UI thought (parameters,
non-trivial filter widget shape — e.g. a range vs. a multi-select vs. a date picker), then run an
`impeccable` pass on the resulting filter UI (per field) and automation UI (per task). Record the
UI/UX decisions (widget choice, parameter shape, copy) back into
`docs/in_progress/provider-e2e-spec/specs/sonarr.md`, linking any prototype artifacts rather
than pasting them in.
