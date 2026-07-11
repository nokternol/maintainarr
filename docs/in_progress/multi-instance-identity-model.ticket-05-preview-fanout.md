---
title: "Phase 5: Preview fan-out"
labels: [wayfinder:task]
status: closed
assignee: claude
blocked_by: [multi-instance-identity-model.ticket-01-authority-and-factory-surface.md, multi-instance-identity-model.ticket-04-enrichment-paths.md]
---

## Question

Replace `MediaSourceFactory.forContentType` with a fan-out surface, per
[the design](./multi-instance-identity-model.md) §9 (Implementation order, step 5):

- Add `sourcesFor(contentType): Promise<Array<{ providerId, name, source: MediaSource }>>` — one
  constructed `mediaSourceFor(provider, settings.id)` per active instance owning that content type.
- Update the preview handler (`GET /media-queries/:id/preview`, `mediaQueries.handler.ts`) to evaluate
  the query spec once per instance and return `{ count, instances: [{ providerId, name, count }] }`,
  summing per-instance item counts. Zero active instances returns `{ count: 0, instances: [] }`.
- `MediaQuery`/`MediaQuerySpec` in `mediaQueryEngine.ts` stay unchanged — fan-out is the handler's loop.

Verify: with exactly one active instance, the response's `count` is bit-identical to today's and
`instances` is a length-1 additive field.
