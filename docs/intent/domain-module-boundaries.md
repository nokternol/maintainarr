# Domain module internals: not yet shaped

**Status:** INTENT (direction only, not designed). Recorded from a design conversation during the
media-enrichment EAV planning session (shipped as `docs/architecture/media-enrichment-eav-model.md`),
which produced the first concrete data point but does not itself resolve this doc's question.

## The problem

This codebase is migrating away from a default-agent-shaped architecture (services and factories wired
directly to `DrizzleDb`, each writing its own queries inline — see `EnrichmentJobFactory`,
`mediaQueryEngine.ts` for the current shape) toward domain modules with clearer internal boundaries. What
a domain module's internals should look like — where a query lives, what's a seam versus an
implementation detail, how a module's own tests reach into it — has not been decided. Today, every module
takes `db: DrizzleDb` as a constructor/factory dependency and issues queries inline; there is no
established alternative pattern anywhere in the codebase yet.

## Why it matters

The concrete motivation raised so far: extracting a module's queries into their own object (rather than
inlining them in the class/function that uses them) gives module tests a `vi.mock`-able seam at the
module boundary. That enables testing a module's own behavior in depth — precedence, merge, gating logic,
whatever the module actually owns — independent of the database, instead of every test needing a real (or
fully-faked) DB round-trip to exercise that behavior at all.

## First concrete instance (not yet a converged pattern)

`docs/architecture/media-enrichment-eav-model.md`'s shipped rewrite introduced `enrichment.queries.ts`: a
class holding the EAV pivot query (`json_group_object` read, keyed by `mediaIdentityId`), constructed with `db` and
registered via awilix in `media.registrations.ts` — the same DI mechanism (`container.ts`) every other
module already uses, just applied to a query object instead of a service. `enrichmentMerge.ts` and
`EnrichmentJob` take this queries object as a dependency in place of raw `db` access for that query.

This is one data point, not a resolved convention. It has no precedent elsewhere in the codebase (checked
during the EAV planning session — `EnrichmentJobFactory`, `mediaQueryEngine.ts`, and every other module
inject `db` directly and query inline today), so it should not be read as "the shape all modules now
follow" until more modules actually adopt something like it and the pattern gets named on its own terms.

## Open questions (not investigated)

- What qualifies as a seam worth extracting into a queries object versus a query trivial enough to stay
  inline — one query per object, or one queries object per module covering several queries?
- Whether this generalizes to a `<module>.queries.ts` convention per domain module, or whether different
  modules land on different internal shapes because their query patterns genuinely differ (automations vs.
  media vs. providers).
- Whether the DI registration for a queries object should be its own cradle entry (as `enrichment.queries.ts`
  will be) or nested/private to the module that owns it, not exposed on the shared `Cradle` interface at all.
- How this relates to (if at all) the existing per-module `*.registrations.ts` / `*Cradle` pattern
  (`server/container.ts`) — whether queries objects are just another registration in the same file, or
  warrant their own registration entry point.
- What "domain module" actually means as a unit here — is it today's `server/modules/*` boundary, or a
  different cut once this shaping work happens?
