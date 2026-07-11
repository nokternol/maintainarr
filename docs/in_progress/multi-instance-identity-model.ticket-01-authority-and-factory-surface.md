---
title: "Phase 1: Authority + factory surface"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: []
---

## Question

Build the role-membership authority and factory surface with **no observable behavior change** — the
single-active invariant stays global throughout this ticket. Per
[the design](./multi-instance-identity-model.md) §6–§7 (Implementation order, step 1):

- Add `MediaKind`, `SOURCE_OWNER_BY_KIND`, `isMediaSourceType`, `kindOfSourceType` to
  `server/modules/providers/roles.ts`; export through `providers/index.ts`.
- Delete `OWNER_TYPE` from `media/mediaSourceFactory.ts`; `MediaSourceFactory`/`sourceOwnership()` import
  `SOURCE_OWNER_BY_KIND` instead (media derives, does not re-declare).
- Make `ContentType = MediaKind` a type alias in `media/filterRegistry.ts`; existing consumers untouched.
- Add `ProviderInstance`/`createInstances` to `server/modules/providers/providerFactory.ts`.
- Slim `ProviderSet`: drop the `radarr`/`sonarr` slots and `createMany`'s branches for them.

Verify: `dependency-cruiser` stays green with zero rule changes (no `providers → media` import
introduced); every current single-instance read path returns identical data.
