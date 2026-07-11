# Automation archive & restore (soft delete)

**Status:** INTENT — not yet built. Independent of the event-driven cache/realtime work; can be picked up
on its own.

## The problem

Deleting an automation today is a single, permanent, irreversible action. There's no undo, and no record
kept once a user hits delete — including for automations a user is actively iterating on, or deleted by
mistake. Run history for a deleted automation goes with it.

## Why it needs solving

Automations are configuration a user tunes over time (query, task, schedule) — the kind of thing people
delete experimentally and regret, or delete and later want to reference the run history of. A destructive,
one-step, unrecoverable delete is the wrong default for that usage pattern. It also has no place for
system automations, which are invariant by design and should never be deletable by a user at all.

## The shape of the fix

- **Delete becomes Archive**, a soft, restorable state — not a new destination screen, just a filterable
  state on the existing Automations view. An archived automation is inert (unscheduled, not runnable) but
  its run history is retained and remains inspectable.
- **Permanent delete survives, but only as a deliberate second step**, reachable only from the archived
  state. This makes archive-before-delete an actual invariant rather than a UI convention — no path
  exists to hard-delete a live automation directly.
- **No auto-purge.** Archived items stay until a user explicitly deletes them. Auto-purging on a timer
  would silently destroy recoverable data — the entire point of archiving — so it's deferred indefinitely
  unless the archived-table size ever actually becomes a problem in practice.
- **System automations are exempt.** They cannot be archived or deleted at all, consistent with their
  existing Run-Now-only invariants.

## Blockers / friction

- This is a genuine behaviour change to an existing endpoint: today's delete path (dashboard trash
  button, and the tests around it) hard-deletes directly. Making archive-before-delete a real invariant
  means rewiring that existing control, not just adding a new one alongside it.
- The verb this introduces ("Archive," not a bare trash icon) needs to land consistently with any other
  automation-verb relabeling happening elsewhere (see `docs/intent/realtime-event-driven-cache.md`'s
  visual pass) — shipping this in isolation risks a mismatched icon/verb vocabulary if the other lands
  later with different naming.
</content>
