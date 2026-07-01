# Follow-up investigation: Trial 2 (identity-resolution task)

Same standard applied as the Trial 1 follow-up: verify the workers' and the judge's claims directly
against evidence rather than accept either at face value, since Trial 2 was specifically designed to give
the graph tool its best plausible shot and the result still didn't favor it. Two things were checked in
depth: (1) whether the graph-assisted worker's self-reported query log was accurate, and (2) whether the
judge's grading of the two plans was accurate — it was not, on one material point, and that error is
documented here in full rather than folded quietly into the combined report.

## Part 1 — verifying the graph-assisted worker's query log

The worker self-reported three notable graph-tool calls: two duds and one clean hit. All three were
re-run directly against the same graph to confirm the self-report wasn't understating or overstating the
tool's behavior.

**Query 1 (self-reported as irrelevant):**
```
$ graphify query "how does linking a Plex library item to a canonical identity record work"
Traversal: BFS depth=2 | Start: ['canonical', 'canonical', 'canonical'] | 16 nodes found

NODE colorMeta [src=.impeccable/design.json loc=L6 community=152]
NODE text-secondary [src=.impeccable/design.json loc=L127 community=219]
NODE warning [src=.impeccable/design.json loc=L172 community=220]
...
EDGE canonical --contains [EXTRACTED]--> text-secondary
EDGE canonical --contains [EXTRACTED]--> warning
```

This is worse than the worker's own summary suggested. The query's entity extraction reduced an
11-word natural-language question to three repeated copies of the single word "canonical," then ran a
breadth-first traversal from a completely unrelated node: a color-token definition in a design-system
JSON file (`.impeccable/design.json`), which happens to use "canonical" as a field name for its color
palette structure. Every single result returned is a design token (`text-secondary`, `warning`,
`tonalRamp`, `displayName`) — nothing related to Plex, identity resolution, or media at all. The tool
didn't return a weak or tangential answer; it returned a categorically wrong one, silently, with no
indication to the caller that the query had failed to find its actual subject.

**Query 2 (self-reported as a dud):**
```
$ graphify explain "identity linking"
No node matching 'identity linking' found.
```
Confirmed exactly as reported — a clean miss, at least an honest one (no node, rather than a wrong node).

**Query 3 (self-reported as the single most useful call):**
```
$ graphify explain "identityResolutionJob"
Node: IdentityResolutionJob
  Source: server/jobs/identityResolutionJob.ts L26 | Community: 8 | Degree: 9
Connections (9): identityJobFactory.ts [imports], identityResolutionJob.test.ts [imports],
  .setPlexRatingKey() [method], .runForPlex() [method], .create() [references],
  .constructor() [method], .runForMovies() [method], .runForSeries() [method]
```
Confirmed exactly as reported — clean, correct, complete. Every edge is real and relevant.

**Conclusion from Part 1**: the worker's self-report was accurate and, if anything, generous to the tool
on Query 1 — it described the result as "irrelevant" without noting that the query had been silently
reduced to a single repeated keyword before it ever ran. The pattern from Trial 1 repeats exactly: natural
language and abstract-noun queries fail (often silently, returning confident-looking wrong answers rather
than an error), while an exact, unambiguous class/symbol name resolves cleanly. The one success in Trial 2
was not the graph "understanding" the task — it was the tool functioning correctly as a symbol lookup
once the worker had already, via ordinary grep, identified the exact symbol to look up.

## Part 2 — the judge over-sold Plan D's completeness, verified and corrected

The judge's Trial 2 grading gave the docs-only plan (Plan D) 9/10 on context-gathering completeness,
stating: *"Plan D: 9/10. Hits all the same points as C, plus is the only plan that actually opened and
read `server/jobs/enrichmentJob.ts`... [ground-truth point 3, the doc-staleness requirement] ... Plan D
hits all the same points as C."*

This claim was checked directly against Plan D's actual text rather than accepted:

```
$ grep -n "provider-roles-and-identity\|docs/architecture" plan-D.md
59:2. List docs, docs/architecture, docs/intent, docs/in_progress — enumerated doc files...
60:3. Read: docs/architecture/provider-roles-and-identity.md — as-built identity model description...
75:18. Grep: imdb in docs/intent, docs/architecture, docs/in_progress — confirmed no existing intent
    doc already plans this specific change.
```

Both hits are in Plan D's **exploration log**, not in its **plan**. Plan D's actual "Changes, in order"
section (the part a reviewer would act on) lists exactly two files:

1. `server/jobs/identityResolutionJob.ts`
2. `server/__tests__/services/identityResolutionJob.test.ts`

`docs/architecture/provider-roles-and-identity.md` does not appear anywhere in that list. Plan D's worker
read the doc during exploration, correctly noted (in the exploration log only) that it currently states
`runForPlex` matches "by tmdbId/tvdbId," and then never carried that observation into the deliverable. By
contrast, Plan C's actual plan lists the doc update as file #3, quotes the exact stale line, and labels it
"not optional." Ground-truth point 3 explicitly said a complete plan should include the doc fix "as a
required step, not an afterthought" — Plan D's plan doesn't include it as either; it's simply absent from
the thing that would actually get implemented.

**Why the judge likely made this error**: the judge was working from both the plan text and the
exploration log together, and appears to have treated "the log shows it read the file and drew the
correct conclusion" as equivalent to "the plan includes fixing it." Those are different things — reading
a doc during research and then dropping the resulting action item before finalizing the plan is exactly
the kind of silent omission this whole experiment is trying to detect, so it's a real weakness in Plan D,
not a wash.

**Corrected scoring**: Plan D deserves credit it wasn't fully denied elsewhere — it's still the only plan
that opened `enrichmentJob.ts`, giving it a real (if under-written) edge on the downstream-corruption risk
(ground-truth point 2). But on point 3 specifically, Plan D should score *lower* than Plan C, not equal —
the reverse of what the judge concluded. Rebalancing just that sub-score brings the two plans' overall
completeness closer to a tie (roughly 7/10 each) rather than the judge's stated 7-vs-9 gap. This doesn't
change the trial's overall verdict — Plan D still wins clearly on cost (fewer tokens, less time) and on
quality/uncertainty-surfacing (it flags the drizzle `eq()` typing risk with a concrete fallback, which
Plan C glosses over) — but the completeness margin specifically was overstated and is corrected here.

## What this adds to the overall finding

Trial 2 was built to be the fairest possible test *for* graphify: a task selected because the graph
resolves its core entities cleanly and precisely, with no ambiguity. Even there:

- The tool still failed on the natural-language query a person would actually type first, in the same
  silent-wrong-answer way as Trial 1 (worse, in fact — Trial 1's bad query returned noise from the right
  general vicinity of the codebase; Trial 2's bad query returned unrelated design tokens from a
  completely different subsystem, because the query planner discarded everything except one ambiguous
  common word).
- Its one clean success required the worker to already know the exact symbol name — which it obtained via
  grep first, not via the graph.
- Even with that one clean success, the docs-only worker still won on cost and tied-or-won on quality,
  because reading the actual downstream consumer file mattered more to plan quality than any graph query
  result did in either direction.
- The judge, independently, over-credited the docs-only plan on the one point where it had a genuine gap
  (the dropped doc-update action item) — a reminder that the grading step in this pipeline needs the same
  "verify, don't just accept" discipline applied to the workers.
