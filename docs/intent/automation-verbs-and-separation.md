# Automation Verbs & System/User Separation

**Status:** INTENT — concept resolved; the relabel + visual pass is an impeccable execution step.
Supersedes the "pause"/"read-only" framing in `system-vs-user-automations.md`.

## The verbs

Play/Pause was the wrong metaphor: it implies **runtime control over an executing process** —
suspend mid-flight, resume from where it stopped. Cross-system jobs cannot honour that (you can't
cleanly cancel a half-done enrichment pass, let alone resume it), so it is a well-intentioned lie.
The honest model is three distinct verbs, none of which claim to touch an in-flight run:

| Verb | Means | Icon language | Touches a running process? |
|---|---|---|---|
| **Run Now** | execute on demand | **refresh** (not play) | no — fires a new run |
| **Disable** | stop the schedule from firing (future cron ticks only) | power / on-off (not pause) | no |
| **Archive** | retire (soft delete, restorable) | archive (not just trash) | no |

"Disable" is a *scheduling* state, not a *runtime* one. It maps to the existing
`status: 'active' | 'paused'` column — **relabelled in the UI only**, no migration in this pass (the
enum value `paused` stays; the user sees "Disabled"). Renaming the enum end-to-end is a later option
if the storage/wire honesty is judged worth a migration.

## System Tasks vs User Automations — separate screens, shared row

Both are `kind`-tagged rows in the same `automations` table, scheduled and executed by the same
infrastructure (see `system-vs-user-automations.md`). They are surfaced on **separate screens**:

- **Automations** — user automations. Full controls: Run Now + Disable + Archive.
- **System → Tasks** — system automations. **Run Now only.** System jobs are invariants that must
  keep firing, so Disable and Archive/Delete are forbidden (enforced server-side: `updateStatus` and
  `delete` reject `kind='system'`).

`AutomationRow` is **shared across both screens** and derives control visibility from
`automation.kind` (`isUserAutomation` gates the schedule toggle and the destructive action; Run Now
shows for both). This is correct *because* system and user tasks are structurally the same row.

### Column specialisation is the known divergence

`AutomationRow`'s metadata subline is user-shaped (`query · provider · task`); system rows have null
`query`/`provider` and read sparse. A fully-featured System → Tasks screen (cf. Radarr: interval,
last run, **run duration**, next run, refresh) will want different columns. The decision: **keep the
shared row now** (cheap, consistent), **specialise the system row's columns later** when run-duration
/ interval semantics actually exist. Do not unify columns prematurely.

## impeccable pass (deferred execution)

The relabel (Run Now → refresh icon; pause → "Disable" + power icon; trash → "Archive"), the live
"running…" state from SSE, and the System → Tasks column treatment are a single **impeccable** visual
pass. Deferred until after SSE lands so the running-state visual is designed in one go rather than
twice.
