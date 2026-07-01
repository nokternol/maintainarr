# graphify vs. plain markdown docs: two controlled planning trials

**Question tested:** for AI-assisted planning of a non-trivial change, does a knowledge-graph tool
(graphify) find richer connections more cheaply than an agent working from good markdown docs alone —
and does that translate into a better implementation plan? Two trials were run: the first task was picked
blind (required wide discovery, no attempt to favor either method); the second was deliberately picked to
sit inside the graph's own flagged strong structure, to give the tool its best plausible shot.

**Bottom line up front:** Across both trials, the docs-only agent matched or beat the graph-assisted agent
on cost, and matched or beat it on plan quality. In Trial 1, graphify's imprecise concept-matching
actively misdirected the agent. In Trial 2 — a task deliberately chosen around one of the graph's own
cleanest, highest-degree nodes — the graph tool worked precisely exactly where it was pointed at an
unambiguous symbol name, but that one precise result still didn't translate into a cheaper or better plan
than plain grep/read: the docs-only agent got equivalent (in some ways deeper) understanding at lower
cost. Neither trial found a case where the graph paid for itself.

---

## Trial 1: blind task (rule-vocabulary dataType)

### Methodology

Two identical clones of this repo (same commit), one with graphify + all skills/hooks intact
(`with-graph`), one with all of that tooling stripped (`docs-only`, markdown docs left exactly as-is).
Same product-level task brief given to both, same model (Sonnet 5), both restricted to producing a
written plan only (no code edits). A ground-truth survey (done independently, before either worker ran)
established that the task — adding a new `multi-select` filter dataType — has a known trap: the dataType
vocabulary is duplicated across 5 layers, and two superficially "fixed set" rules (`genres`, `network`)
are actually populated dynamically from live provider data, not statically declared.

### Result

| | Graph-assisted | Docs-only |
|---|---|---|
| Tool calls | 33 | 33 |
| Tokens | ~72,400 | ~81,500 |
| Duration | ~249s | ~259s |
| Judge: completeness | 8/10 | 10/10 |
| Judge: efficiency | 6/10 | 6/10 |
| Judge: plan quality | 6/10 | 9/10 |

Cost was a near-tie. The docs-only plan won decisively on quality: it caught the genres/network
dynamic-data trap (by reading `useMediaLookups.ts`) and picked a genuinely correct POC rule (`seriesType`);
the graph-assisted plan missed this and would have shipped a hardcoded, driftable duplicate of data that
already has a live source.

### Why: direct evidence, not speculation

Two of the same graph queries were re-run directly against the copied graph to check the mechanism:

```
$ graphify explain "genres"
Node: GENRES | Source: MediaFilterBar.stories.tsx L34 | Degree: 1
Connections (1): <-- MediaFilterBar.stories.tsx [contains]
```

This resolved to a Storybook string literal, not the real `genres` rule or its link to
`useMediaLookups.ts`. Multiple things in the repo are named "genres"; the tool picked an essentially
arbitrary, useless one.

```
$ graphify path "filterRegistry" "useMediaLookups"
warning: source match was ambiguous (top score 715.143, runner-up 715.143)
Shortest path (6 hops): filterRegistry.test.ts --imports--> NormalizedShow
  <--imports-- automationExecutor.test.ts --imports--> server
  <--imports-- media.page.test.tsx --imports_from--> index.tsx --imports--> useMediaLookups()
```

Graph-theoretically valid, architecturally meaningless. The edges traversed are raw `imports`/`contains` —
the same thing `grep -rn "import.*useMediaLookups"` gives directly.

The tool's own rebuild log shows why: automatic hooks perform AST-only extraction ("no LLM needed," per
the tool's own docs), while a separate richer/curated pass — the thing that would presumably
differentiate this from a plain import graph — repeatedly logged `WARNING: refusing to overwrite` in the
period covered. What the worker queried was close to a bare AST import graph, not an enriched one.

**Why did the docs-only agent match on cost and win on completeness?** The actual "find every touch
point" question was answerable exhaustively by `grep -rn "dataType"` alone (~500 files, one consistent
identifier). A precomputed import graph doesn't compress that further. The completeness gap came from the
docs-only agent reading `src/hooks/*.ts` as a full directory sweep out of general thoroughness — not
because any doc or query pointed there. The graph-assisted agent trusted its noisy `explain`/`path`
results as a reasonably complete relevance map, and nothing ever signalled it to go read that file. The
tool's imprecision didn't just fail to help — it displaced the brute-force sweep that would have closed
the gap.

**A positive counter-check, run at the same time:** `graphify explain "Cradle"` (the DI container's root
type) resolved cleanly to a single, unambiguous, richly-connected node (degree 32, real consumers
correctly listed) — a sharp contrast to the "genres" dead end. This suggested the tool's quality is not
uniformly bad — it's bad specifically where a name is ambiguous, and good where a concept has one clear,
structurally central definition. Trial 2 was designed around that distinction.

---

## Trial 2: graph-favorable task (cross-provider identity resolution)

### Why this task

Rather than continue testing on a blindly-picked task, this trial deliberately targeted a concept the
graph itself flags as strong: `graphify explain "mediaIdentity"` (degree 16) and
`graphify explain "IdentityResolutionJob"` (degree 9) both resolved cleanly and precisely — unambiguous
single nodes, correct consumers, no noise — during pre-trial verification. This sits inside the graph's
own "Cross-Provider Join Chain" community, one of its highest-confidence extracted hyperedges. This trial
is explicitly **not** a blind pick like Trial 1 — it targets the graph's edges, labels, and community
structure directly, to give the tool its best plausible shot at demonstrating value.

**The task**: `IdentityResolutionJob.runForPlex()` (`server/jobs/identityResolutionJob.ts`) only matches
Plex GUIDs shaped `tmdb://<id>` and `thetvdb://<id>` — never `imdb://<id>`, even though the
`media_identity` table already has an `imdbId` column and index. An independent ground-truth survey
confirmed a genuine hidden subtlety: `imdbId` is a `text` column while `tmdbId`/`tvdbId` are `integer`
columns, so the fix is not "add a third branch" but a real type-widening change, plus a documented (but
easy-to-miss) downstream corruption risk in `enrichmentJob.ts`'s `hydrate()`, plus a now-stale line in
`docs/architecture/provider-roles-and-identity.md`.

### Result

| | Graph-assisted | Docs-only |
|---|---|---|
| Tool calls | 21 | 22 |
| Tokens | ~43,900 | ~38,300 |
| Duration | ~152s | ~130s |
| Judge: completeness (as scored) | 7/10 | 9/10 |
| Judge: efficiency | 6/10 | 8/10 |
| Judge: plan quality | 7/10 | 9/10 |

The docs-only agent was cheaper on every raw metric this time too, and the judge scored it higher across
the board.

### The judge over-sold Plan D's completeness — caught and corrected

The judge's completeness score (7 vs. 9) was not accepted at face value. Full verification is written up
in `trial-2-investigation-followup.md`; the short version: the judge wrote *"Plan D... hits all the same
points as [Plan C]"* — including the ground-truth requirement that a complete plan update the now-stale
`docs/architecture/provider-roles-and-identity.md`. That's false. Grepping Plan D's actual text shows the
doc only appears in its **exploration log** ("Read: docs/architecture/provider-roles-and-identity.md —
as-built identity model description...") — never in its "Changes, in order" deliverable, which lists
exactly two files (the job source and its test). Plan D's worker read the stale doc, silently understood
it was wrong, and then dropped that finding before it reached the plan a reviewer would act on. Plan C, by
contrast, lists the doc fix as file #3 of its plan and quotes the exact stale line, unprompted.

The judge appears to have conflated "the log shows it read the file and drew the right conclusion" with
"the plan includes fixing it" — those are different things, and the gap between them is exactly the kind
of silent omission this whole experiment exists to catch. Corrected picture: each plan had one distinct
completeness gap the other didn't (Plan C under-argued the downstream corruption risk in
`enrichmentJob.ts`, a file it never opened; Plan D opened that exact file but dropped the doc-update
action item entirely), which pulls completeness closer to a tie than the judge's 7-vs-9 gap suggests. The
cost and quality gaps in the docs-only agent's favor hold up independently of this correction.

### Why: the graph worked precisely, once — and it still didn't win

The graph-assisted worker's log shows the exact same pattern as Trial 1 at first: two natural-language
graph queries failed. Re-running them directly (see `trial-2-investigation-followup.md` for the full
transcripts) showed it was worse than the worker's own summary implied:

```
$ graphify query "how does linking a Plex library item to a canonical identity record work"
Traversal: BFS depth=2 | Start: ['canonical', 'canonical', 'canonical'] | 16 nodes found
NODE colorMeta [src=.impeccable/design.json ...]   NODE text-secondary [...]   NODE warning [...]
```

The query's entity extraction collapsed an 11-word question down to three repeated copies of the single
word "canonical," then traversed into an unrelated design-token JSON file — every result returned was a
color token, nothing to do with Plex or identity resolution. This isn't a weak answer; it's a
categorically wrong one, returned with no signal to the caller that anything had gone wrong. The second
query, `graphify explain "identity linking"`, failed cleanly instead (`No node matching... found`) — at
least an honest miss.

— before the agent fell back to grep, found the file by a schema-column grep, and *then* ran
`graphify explain "identityResolutionJob"` — a precise, unambiguous class name — which worked cleanly:
correct methods, correct callers, no noise. The worker itself called this "the most useful single tool
call in this exploration," and re-running it directly confirmed the result was clean and correct.

That is a genuine positive result for the tool: when pointed at an exact, unambiguous symbol, it returned
a clean, correct answer. But it did not translate into a cheaper or better plan than the docs-only agent,
which reached the same file through directory listing and grep alone, at lower token/time cost, and which
was the only agent of the two to actually open the downstream consumer file (`enrichmentJob.ts`) that the
ground truth flagged as the key to the hardest risk in the task. The single clean graph hit paid for
itself in precision, not in net cost or in plan completeness — and it only worked because the worker had
already found the exact symbol name via grep first, not via the graph.

---

## Overall conclusion, across both trials

1. **Cost**: docs-only was cheaper or tied in both trials. The graph tool never produced a net token/time
   saving in either trial run here.
2. **"Richer connections"**: only sometimes, and narrowly. The graph produced clean, correct,
   unambiguous answers exactly twice across both trials — both times when queried with an exact,
   unambiguous symbol name (`Cradle`, `mediaIdentity`/`IdentityResolutionJob`) rather than a natural-
   language description or an ambiguous common noun (`genres`, "canonical," "identity linking"). Every
   natural-language or ambiguous-noun query across both trials either returned noise or resolved to the
   wrong node.
3. **Plan quality**: docs-only was equal-or-better in both trials, including in the trial deliberately
   designed to favor the graph.

**What actually predicted plan quality, in both trials, was not which tool was used but where the
agent's reading effort landed** — specifically, whether it did a full directory/file sweep of the small
number of directly relevant files rather than relying on a query result to tell it where to look next.
The docs-only agent did this consistently (reading `useMediaLookups.ts` "on the way" in Trial 1;
reading `enrichmentJob.ts` in full in Trial 2) without being told to. The graph-assisted agent, both
times, spent part of its budget on queries that came back empty or wrong before falling back to the same
grep/read approach — meaning its net advantage, when it had one, was thin and inconsistent.

**On task-type dependence**: this doesn't establish that no task ever favors a graph tool. Both trials
were on the same repo (~500 files, mostly consistent naming, current and accurate docs). The one
consistent signal across both trials is narrower and more specific than "big codebase, complex task": the
graph adds precision specifically at the moment of resolving one exact, unambiguous symbol name to its
correct definition and callers — a "go to definition + find references" job. It has not, in either trial
run, demonstrated value at the harder job its marketing implies: surfacing a *non-obvious* relationship
between two concepts an engineer wouldn't already know to look for together. Both times that
non-obvious-relationship job came up (genres↔useMediaLookups, identity-collision↔hydrate), the docs-only
agent's brute-force directory reading found it (or came closer to it) and the graph did not.

**Recommendation, if this is worth a third data point**: test a task where the graph's "go to definition +
find references" strength is actually the bottleneck — e.g., an impact-analysis question in a
significantly larger codebase than this one, where a full directory/grep sweep is not feasible within a
reasonable budget and the agent must rely on precomputed structure rather than brute force. That is the
condition under which this tool's core mechanism (precise symbol resolution) would need to carry real
weight, rather than being a nice-to-have shortcut to a place grep would have reached anyway.

## Note on the `plan-with-graph` skill

Separate from the above — the autonomous-agent trials above cannot evaluate `plan-with-graph`, since its
value proposition is a human-in-the-loop correction process (interactive dialogue correcting the graph's
understanding to match yours), not unattended retrieval speed. The failure mode both trials exposed —
bad node disambiguation, noisy edge weighting on ambiguous terms — is exactly the kind of thing a human
correcting the graph interactively would catch before an autonomous agent ever queries it. If that claim
is worth testing, the fair experiment is different from this one: run a `plan-with-graph` session on one
of the systems above, see whether it corrects the graph's disambiguation for the term that failed (e.g.
"genres" or "canonical"), then re-run the autonomous agent on a related task afterward and check whether
it now avoids the same trap. That isolates "does human curation fix the graph" from "does the graph help
without it" — the two are different claims and this report only speaks to the second one.

## Limitations

- n=1 per arm, per trial (n=2 trials total). Both trials point the same direction, which is a stronger
  signal than either alone, but still a small sample.
- Both trials are on one repo, of modest size, with currently accurate documentation. A repo with stale
  docs, or one an order of magnitude larger, could change the docs-only arm's advantage specifically —
  its wins in both trials trace partly to the docs being good and partly to thorough brute-force reading,
  and it's not fully separable from this report's results which of those did more work.
- The judge is an LLM from the same model family as the workers, grading from self-reported logs rather
  than raw transcripts. One judge error was caught and corrected here (Trial 2's completeness scoring —
  see `trial-2-investigation-followup.md` for the full verification); there is no guarantee other, smaller
  errors weren't missed.

## Deep-dive follow-ups

Both trials' tool-behavior claims and the Trial 2 judge's grading were independently re-verified rather
than accepted as reported, with full transcripts:

- `trial-1-investigation-followup.md` — direct re-run of the Trial 1 graph queries, the rebuild-log
  evidence for why the curated/enriched graph pass wasn't landing, and the `Cradle` positive counter-check.
- `trial-2-investigation-followup.md` — direct re-run of the Trial 2 graph queries (including the
  `['canonical', 'canonical', 'canonical']` entity-extraction failure), plus the full verification of the
  judge's completeness-scoring error on Plan D.
