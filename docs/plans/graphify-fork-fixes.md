# graphify fork: fixes that improve natural-language query outcomes

## Direction decision (2026-07-04)

**The generative-AI query-time term reformulation (#1611) has been unwound.** After live validation showed
the deterministic fixes (#1445, #1610, #1612, #1613, #1614) already carry the improvement on their own (see
the re-validation table below — every re-tested query already resolved correctly with reformulation *off*),
the user decided the LLM-shell-out lever was the wrong one for now: real per-query latency/cost, an extra
dependency (`claude -p` CLI availability/auth), and non-determinism, for marginal gain the math-only fixes
already deliver. **#1611 has been dropped from the fork branch** via `git rebase --onto` (not a revert commit
— the commit and its `--reformulate` flag, `GRAPHIFY_QUERY_REFORMULATE` env var, and `query_reform` cache
path no longer exist on the branch at all). The `keywords`-field design (#1615 candidate, see below) is
**also shelved** for the same reason — it's LLM-generation-based too, and is now paused pending re-evaluation
alongside #1611, not actively being built.

**What stays:** the deterministic, mathematical fixes — #1445 (seed diversity), #1610 (cache reattachment),
#1612 (relevance ranking), #1613 (`explain` ambiguity), #1614 (`path` ambiguity). These involve no LLM calls,
no added latency, no external dependency, and are what the rest of this doc now describes as "the fork."

## Four more deterministic fixes, found via cheap sampling + a forensic dive (2026-07-04)

A forensic re-read of Trial 5's actual tool-call transcripts (not just its final plans) found the
graph-assisted run's one real catch — a route-collision bug — came from a plain `Read`, not any `graphify`
call; every `graphify` call in that transcript was checked and none surfaced it. A much cheaper follow-up
experiment (six single-command "first move" probes from fresh Sonnet subagents, across three fresh
questions, graded against pre-verified ground truth — see
`docs/experiments/graphify-vs-docs-2026-07-01/` for the methodology this extends) surfaced three concrete,
reproducible, deterministic bugs — no generative lever needed to explain any of them:

**#1616 — `explain` hard-fails to zero on multi-word natural-language phrases.** `_find_node_tiers` requires
the whole query, tokens rejoined into one string, to match/prefix/substring a single node's label as a
whole — so a real phrase like `explain "critic score aggregation"` returned `No node matching found`, silently,
even though `ratingsAggregation.ts` and its real symbols were sitting right there scoring highly on the same
terms individually. Worse than noise: a hard, silent dead end with no signal anything went wrong. Fixed in
`graphify/__main__.py`'s `explain` command: when the tiered lookup is empty and the phrase has more than one
token, fall back to the same per-token `_score_nodes` scoring `query` already uses, and list the top
candidates by term overlap in the existing ambiguity-list format, instead of the bare dead end. Single-word
misses are unaffected (gated on token count — a one-word probe would score identically to the substring
tier already tried). Regression tests in `tests/test_explain_cli.py`; full suite (2766 tests, 1 pre-existing
unrelated failure) and ruff pass. Verified live: both previously-zero `explain` queries now surface their
real target instead of nothing.

**Self-pollution from this repo's own tool-generated content (not a fork code bug — a project config gap).**
The cheap sampling reproduced Trial 4's finding live: `graphify query`/`explain` results were dominated by
this repo's own `docs/experiments/graphify-vs-docs-2026-07-01/` write-ups (prose *about* graphify itself)
and `.impeccable/critique/*.md` (another local skill's generated critique reports) — tool-generated,
self-referential content, not application code or real documentation, competing for the same lexical
matches as real code. `graphify-out/memory/` (the `#1441` self-improving-work-memory feature) is *not* part
of this — it's deliberately, always ingested by design (`detect.py`: "Always include graphify-out/memory/ -
query results filed back into the graph"), not a bug. Fix: added `.graphifyignore` to this repo (not the
fork) excluding `docs/experiments/` and `.impeccable/`, ran `graphify update . --force` (free, AST-only) to
prune, then a deterministic post-hoc filter of `graph.json` for the 17 remaining doc-sourced nodes that only
an LLM/semantic pass (which this repo has no API key configured for) could re-walk, followed by
`graphify cluster-only . --no-label --no-viz` to re-cluster without any LLM call. Verified: 0 polluted nodes
remain; `docs/architecture/` (103 nodes) and `docs/plans/` (13 nodes) untouched, confirming the exclusion is
scoped precisely, not overreaching.

**#1617 — `_score_nodes`' full-query bonus falsely promotes a bare same-named method over the real
multi-word target, inside `_pick_seeds`' per-term probe.** Live repro: `graphify query "how does a change in
provider settings affect what shows up in search results"` seeded on `tmdbProvider.ts`'s own `.search()`
method and never surfaced `server/modules/search/search.handler.ts` at all — despite that file scoring far
higher (494 vs 7) under the *combined* multi-word query. Root cause: `_pick_seeds`' per-term seed-diversity
guarantee (#1445) probes each distinct query term in isolation via `_score_nodes(G, [term])`. For that
single-token probe, `_score_nodes`' "joined" full-query tier (designed so a multi-word query dominates a
multi-word label) degenerates: `joined` equals the lone term, and any node whose *tokenized* label
(punctuation stripped) reduces to exactly that one word — e.g. `.search()`, whose only word-character
content is "search" — gets falsely promoted to the EXACT tier via the `label_tokens` comparison, even
though the same node correctly fails the per-token loop's own raw exact check a few lines below (raw
".search" != "search"). Three metadata providers each define their own `.search()`; the highest-degree one
won the per-term probe and starved out the real target, which only reaches PREFIX tier for the same bare
word. Fix: gate the joined-tier block on `len(norm_terms) > 1` — a single-token probe has no "multi-word
phrase vs. per-token bag-of-words" distinction to make in the first place; the per-token loop already fully
and correctly handles single-term matching via raw comparison. The combined multi-word query path is
unchanged. Regression tests in `tests/test_serve.py`; full suite (2766 tests, 1 pre-existing unrelated
failure) and ruff pass. Verified live: `search.handler.ts` and its exported symbols now appear in the
traversal for the exact query that previously missed them entirely.

### Re-validation after all three fixes: repeat + expand the cheap sampling (2026-07-04)

Re-ran the same "first move" methodology with the fixed fork installed live (`uv tool install --editable`):
6 fresh Sonnet subagents repeated the original 3 questions (Q1-Q3), and 6 more covered 3 new questions
(Q4-Q6, one deliberately a paraphrase/literal-wording pair on the same target to isolate vocabulary gap from
target difficulty). Every proposed command was executed directly (not simulated) and graded against
pre-verified ground truth.

**Q1-Q3 all now hit, 6/6, no regressions** — including one case (Q1) where a fresh subagent given no
graphify context at all spontaneously chose `graphify query` anyway (CLAUDE.md's convention is sticky) and
it worked; and Q3 where graphify's result was *more precise* than grep's (an 11-node scoped hit vs. grep's
37-file list, both containing the real target).

**Q4 vs Q5 isolates a real, separate, already-known limitation — not a regression.** Same target
(`server/cron/automationScheduler.ts`), two phrasings: Q5's literal wording ("automation scheduler") hit
cleanly on both approaches; Q4's paraphrase ("calendar timing," "kicks off on its own") was hit by grep (in a
noisy list) but **missed entirely** by graphify — the traversal stayed in the general automation domain and
never reached the scheduler/cron file. This is root-cause finding #3 (no embedding/semantic tier) doing
exactly what it's documented to do, not something #1616/#1617 claimed to fix.

**Q6 surfaced a new, distinct bug in #1616 itself — fixed same session, see below.** "How does the app tell
users something is wrong if the server itself couldn't start up properly?" (target: `failedStateMiddleware.ts`)
made #1616's fallback return **1,765 candidates** — the query's only real vocabulary overlap with the corpus
was the generic word "server" (also this repo's top-level backend directory name), so nearly every backend
file tied at the weakest possible bonus tier, with the real target buried past rank 800.

**#1618 — `explain`'s term-overlap fallback (#1616) floods on generic queries instead of degrading honestly.**
Root cause: #1616 fixed the hard-zero-on-multi-word-phrase case but had no floor on how broad a "match" is
useful — a query whose only shared vocabulary with the corpus is one generic word matches a huge slice of the
whole graph at the floor score, and presenting an arbitrary top-10 slice of that as a confident answer is
worse than admitting nothing useful was found. Fix: after scoring, if the candidate count exceeds both an
absolute floor (50, so small graphs/fixtures are never flagged) and 15% of the graph's total node count,
treat it as a noise flood and fall back to the honest zero-match message instead. Genuine large-but-real
candidate lists (e.g. the verified-good 31-candidate case from #1616 itself) stay well under the threshold
and are unaffected — confirmed with a below-threshold regression pin, not just the flood case. Regression
tests in `tests/test_explain_cli.py`; full suite (2769 tests, all passing this run) and ruff pass. Verified
live: the exact 1,765-candidate flood now returns the honest no-match message.

**Commits (this session, on top of #1445/#1610/#1612/#1613/#1614):**
```
2427abe fix: explain falls back to term-overlap candidates instead of hard failing (#1616)
1138e90 fix: gate _score_nodes' full-query bonus to multi-token queries (#1617)
cd436f7 fix: cap explain's term-overlap fallback to avoid noise floods (#1618)
```

## Handoff summary (read this first)

**Fork:** `github.com/nokternol/graphify` (upstream: `github.com/safishamsi/graphify`).
**Location:** `/tmp/claude-1000/-home-nokternol-repos-sandbox/9c107b25-4afb-4e58-ab25-4fa6ef718249/scratchpad/graphify`
— a scratchpad path from an earlier session, not inside this repo. If that path is gone (scratchpads are
session-scoped and can be cleaned up), re-clone: `git clone git@github.com:nokternol/graphify.git`, then
`git remote add upstream https://github.com/safishamsi/graphify.git` and `git fetch upstream`.
**Branch:** `fix/seed-selection-single-term-collision`, currently 5 commits ahead of where this doc's work
started (see commit log below; #1611's commit was dropped via rebase, not stacked on top, so the branch has
no trace of it). Not yet pushed to `origin`/opened as a PR upstream — the user said they're
"happy to push back to graphify in the end if it works well enough," meaning after more validation, not yet.
**Installed live as:** the `graphify` CLI on this machine's `$PATH` (`/home/nokternol/.local/bin/graphify`),
via an **editable** `uv tool install`, replacing the upstream `graphifyy==0.9.4` release that was there
before this work started. Every `graphify` invocation anywhere on this machine — including this sandbox
repo's own CLAUDE.md-driven hooks — is currently running fork code, live, not a copy. Because the install is
editable, the rebase that dropped #1611 took effect immediately, with no reinstall step — `graphify query
--help` no longer lists `--reformulate` (verified live).

**Net effect so far**, same natural-language query used as the running benchmark throughout
(`"how does linking a Plex library item to a canonical identity record work"`), against this sandbox
repo's real `graphify-out/graph.json`:

| | Before (upstream 0.9.4) | After (fork, deterministic fixes only, no `--reformulate`) |
|---|---|---|
| Seeds | `canonical`, `canonical`, `canonical` (entity extraction collapsed the whole 11-word question to one repeated word) | Real mix, no collapse — #1445 guarantees a seed per distinct query term |
| First ~20 rendered nodes | 100% generic infra noise: `vitest.ts`, `schema.ts`, `container.ts`, `config.ts`, `logger.ts` — none relevant | `plexProvider.ts` and `identityJobFactory.test.ts` already rank near the top from #1612's ranking fix alone |
| Failure mode | Confidently wrong, no signal anything went wrong | Correctly resolves the query's actual subject, no LLM call involved |

This is a real, live-verified, categorical improvement on the one benchmark query tested — not yet proven
on a broader query set (see "What's not yet validated" below). It holds with `--reformulate` gone entirely,
per the re-validation table's own note that reformulation was "additive, not load-bearing" for this query.

### Install fork to live + verify, from scratch

```bash
FORK=/tmp/claude-1000/-home-nokternol-repos-sandbox/9c107b25-4afb-4e58-ab25-4fa6ef718249/scratchpad/graphify
# 1. Install the fork as the live `graphify` CLI (editable — code changes take effect immediately,
#    no reinstall needed unless entry points/dependencies change):
uv tool install --editable "$FORK" --force
graphify --version   # sanity check it still runs

# 2. Run the fork's own test suite before trusting anything:
cd "$FORK" && source .venv/bin/activate
python -m pytest -q          # expect: all pass except tests/test_cache.py::test_semantic_prune_removes_orphan_entries,
                              # which fails identically on the unmodified branch (pre-existing, unrelated
                              # test-order flakiness — verified by running it in isolation and via `git stash`)
ruff check graphify/ tests/  # expect: All checks passed

# 3. Re-test live against this sandbox repo's real graph (run from /home/nokternol/repos/sandbox):
graphify query "how does linking a Plex library item to a canonical identity record work"
# compare against the "Before" column above if re-verifying regressions
# (no --reformulate flag exists anymore — #1611 was dropped from the branch, see "Direction decision" above)
```

To roll back to upstream at any point: `uv tool install graphifyy --force` (reinstalls the pinned release,
undoing the editable fork install).

### Re-validation against the experiment doc's other known-failure queries (done)

All 4 originally-documented Trial 1/Trial 2 failure cases were re-run live against the fork. **All 4 are now
fixed** (`path`'s fix, #1614, landed after this table was first written — see below for what it does and
does not cover). Note: this table was written while `--reformulate` still existed on the branch; the rows
below already show the flag added nothing load-bearing for these queries, which is exactly why it was safe
to drop entirely (see "Direction decision" above) — none of these results change now that it's gone.

| Original failure (`docs/experiments/graphify-vs-docs-2026-07-01/`) | Command | Re-tested result |
|---|---|---|
| `explain "genres"` resolved to an unrelated Storybook string literal, degree 1, dead end | `graphify explain "genres"` | **Fixed — #1613.** Now prints an ambiguity notice and lists both `GENRES` (Storybook) and `GenresResponse` (`useMediaLookups.ts`, the relevant one) instead of silently picking the wrong one. |
| `path "filterRegistry" "useMediaLookups"` returned a graph-valid but architecturally meaningless route | `graphify path "filterRegistry" "useMediaLookups"` | **Endpoint ambiguity fixed — #1614.** `filterRegistry.ts` (degree 21) and `filterRegistry.test.ts` (degree 8) were tied at the identical top score; a stable sort tiebreak happened to silently pick the right one, with a stderr warning nobody had to act on. Now surfaces both candidates instead of guessing. The *traversal-through-test-files* problem is separate and still open — see below. |
| `explain "identity linking"` — an honest miss, "No node matching... found" | `graphify explain "identity linking"` | **Unchanged, correctly.** No candidates exist at all for this term — #1613 only changes behavior when candidates exist but were being silently discarded; a genuine zero-match miss is out of its scope by design. |
| The benchmark NL query (see table above) | `graphify query "..."` (no `--reformulate`) | **Improved even without `--reformulate`.** `plexProvider.ts` and `identityJobFactory.test.ts` already rank near the top from #1612's ranking fix alone — the Haiku reformulation (#1611) is additive, not load-bearing, for this query. |
| Same ambiguous term as the broken `explain "genres"`, run through `query` instead | `graphify query "genres"` | **Meaningfully better even before #1613 existed.** Seeds from the same single wrong node (only one term, no diversity possible) — but because `query` *traverses* 2 hops instead of stopping at one node like `explain` used to, it recovers `useMediaFilters.ts` and `FilterState` in the top 10 results. |
| Same ambiguous term, disambiguated with 2 extra words | `graphify query "genres filter rule"` | **Fully fixed.** Correctly resolves to `filterRegistry.ts`, `FILTER_REGISTRY`, `FilterDefinition`, `FilterValue`, `filterFields.handler.ts` — genuinely on-topic results. |

**Conclusion:** the fixes hold up beyond the one cherry-picked benchmark query, and now cover all three
commands (`query`, `explain`, `path`), not just `query`. Important nuance surfaced by #1614: `path`'s
original bad result was **not** caused by either endpoint resolving to the wrong node — both
`filterRegistry` and `useMediaLookups` individually resolved correctly, even before any fix. The bad result
came from silently trusting a coin-flip tie on the source side that happened to land right, and separately,
from the shortest-path *traversal itself* routing through irrelevant test-infrastructure edges (`vitest.ts`)
once both endpoints are correctly resolved — that second problem is structurally different from endpoint
disambiguation and is not fixed by #1613/#1614. See backlog item 1.

### Still not validated

- No before/after re-run of the actual planning-trial methodology (Trial 1 / Trial 2 in the experiment doc)
  has happened with the fork installed — all evidence so far is CLI output on individual queries, not a
  full agent-planning-task cost/quality comparison (the thing the original experiment actually measured).
- N/A — `--reformulate` no longer exists on the branch (unwound, see "Direction decision" above), so there is
  nothing further to validate on it.

## Source map (fork paths, relative to `$FORK`)

| File | What changed | Fixes |
|---|---|---|
| `graphify/serve.py` | `_pick_seeds` per-term seed guarantee; `_query_graph_text` wiring; `_subgraph_to_text` `scores` param + ranking; `_find_node_tiers` (new, tier-exposing split of `_find_node`); `_score_nodes` joined-tier gated to `len(norm_terms) > 1` | #1445, #1612, #1613, #1617 |
| `graphify/watch.py` | `_rebuild_code` semantic-cache reattachment before eviction | #1610 |
| `graphify/__main__.py` | `graphify explain` ambiguity guard + `--force` flag; `graphify explain` term-overlap fallback on zero tier matches + noise-flood cap on that fallback; `graphify path` endpoint ambiguity guard + `--force` flag | #1613, #1614, #1616, #1618 |
| `tests/test_serve.py` | regression tests for #1445 (pre-existing), #1612, #1617 | — |
| `tests/test_watch.py` | regression test for #1610 | — |
| `tests/test_explain_cli.py` | regression tests for #1613 (same-tier ties, precedence collapse, degree-dominance escape hatch, `--force`, two non-regression pins), #1616 (fallback candidates, no-overlap pin, single-word-miss pin), #1618 (noise-flood pin, below-threshold non-regression pin) | — |
| `tests/test_path_cli.py` | regression tests for #1614 (tied endpoint, degree-dominant endpoint, `--force`, non-regression pin) | — |

## Root-cause findings this fork addresses

From source audit + config audit (see `docs/experiments/graphify-vs-docs-2026-07-01/` for the original
investigation):

1. `graphify update .` never runs the LLM/semantic pass on code-only changes — the graph backing this
   repo had zero token-cost rebuilds since 2026-06-13 before this work started.
2. The `keywords` field `_score_nodes` reads as the NL-paraphrase bridge has no writer anywhere in the
   pipeline — permanently empty, so lexical matching never sees paraphrase/alias vocabulary. **Still true
   in the fork.** An LLM-shell-out query-time bridge (#1611) was tried and then unwound (see "Direction
   decision" above); an LLM-based ingestion-time writer for this field (#1615 candidate) was designed but is
   now also shelved for the same reason. This gap remains open, deliberately, pending a non-generative
   approach.
3. No embedding/similarity step exists at query time; `query`/`path`/`explain` are exact/prefix/substring
   token matching only. `rapidfuzz` is build-time dedup only, never consulted at query time. **Still true.**
4. `_pick_seeds`'s 20%-gap cutoff let one term's incidental exact-label match starve out every
   substring-tier candidate from a multi-term NL query, so BFS traversal explored only the neighborhood
   of one unrelated node (repro: `"canonical","canonical","canonical"` seed collapse on an 11-word query).
   **Fixed — #1445.**
5. *(found during this work, not in the original audit)* `_subgraph_to_text`'s `seeds` ranking param
   existed but was never passed by its only caller, so query output was always raw degree-sorted regardless
   of any seeding fix. **Fixed — #1612.**
6. *(found during this work)* `_rebuild_code`'s incremental path drops a re-extracted file's semantic
   content unconditionally, even when a valid cache entry for its current content already exists.
   **Fixed — #1610.**
7. *(found during this work)* `explain` (`_find_node`) has the same single-committed-guess problem #1445
   fixed for `query`'s seeding, in its own resolution step: it silently returns the first candidate from a
   strictly tier-precedence-ordered list, with no signal when other candidates tied in the same tier, or
   when a weakly-connected lone winner in a higher tier fully masks a relevant candidate one tier down.
   **Fixed — #1613** (same-tier ties and precedence collapse both surfaced; degree-dominant winners still
   resolve directly, no false-positive prompts).

## Fixed and verified (commit log, oldest first)

```
cc04070 fix: guarantee per-term BFS seed diversity in query (fixes #1445)       [pre-existing, from an earlier session]
4f50b8c fix: reattach cached semantic content on incremental AST-only rebuilds (#1610)
421d77d fix: rank query output by relevance, not raw degree (#1612)
456caf8 fix: surface ambiguous/precedence-collapsed matches in explain (#1613)
eb4f83f fix: surface ambiguous endpoint matches in path instead of warning (#1614)
2427abe fix: explain falls back to term-overlap candidates instead of hard failing (#1616)
1138e90 fix: gate _score_nodes' full-query bonus to multi-token queries (#1617)
cd436f7 fix: cap explain's term-overlap fallback to avoid noise floods (#1618)
```

**#1611 (opt-in query-time NL term reformulation via Haiku CLI) was implemented, live-verified, and then
unwound** — see "Direction decision" above. It is no longer on the branch: dropped via
`git rebase --onto 4f50b8c 453ec39 fix/seed-selection-single-term-collision`, not a revert commit, so the
branch has no trace of its code, tests, or commit. Full suite re-run after the rebase: 2761 passed, 1 failed
(same pre-existing `test_cache.py::test_semantic_prune_removes_orphan_entries` flake noted throughout this
doc), 28 skipped; `ruff check` clean. Its write-up is kept below, unedited, as a record of what was tried and
why — not as a description of current fork behavior.

**#1445 — BFS seed starvation (`graphify/serve.py::_pick_seeds`)**
Already committed on the fork branch before this work started. `_pick_seeds` now guarantees at least one
seed per distinct query term with any match, tie-broken by node degree, instead of dropping every candidate
below 20% of the top score. Regression test included; full suite (74 tests, at the time) + ruff pass.

Re-verified against this repo's real graph: seeds went from `canonical`×3 to a real mix including
`plexProvider.ts` and `identityJobFactory.test.ts`. **Necessary but not sufficient** — see #1612, which
found the seeds this fix carefully selected were being discarded before rendering.

**#1610 — semantic content dropped on every incremental touch of a re-extracted file
(`graphify/watch.py::_rebuild_code`)**
Root cause: the code-only incremental path evicts a re-extracted file's prior semantic nodes/edges
unconditionally and never regenerates them (no LLM call by design), even when the semantic cache already
holds a valid, content-hash-matched result for that file's exact current bytes — e.g. right after a
full/deep run, or on a no-op/reverted edit. `_rebuild_code` now checks the content-hash-keyed semantic cache
for every re-extracted file before eviction and reattaches any hit alongside the fresh AST nodes. Zero added
LLM cost (cache lookup only), deterministic (reattached content is byte-identical to a full rebuild's cached
output, not a fresh possibly-varying LLM call), strictly additive (files with no cache entry keep today's
AST-only behavior exactly). Regression test:
`test_rebuild_code_reattaches_cached_semantic_nodes_for_reextracted_file` in `tests/test_watch.py`.

**Scope:** only helps when a cache entry already exists for the file's current content. Does not make
`graphify update .` run the LLM pass more often, and does not by itself improve this repo's graph today
(no `GEMINI_API_KEY`/`GOOGLE_API_KEY` configured, only 3 historical semantic-cache-writing runs total, so
there's little cache to reattach yet). Its value is structural: once semantic extraction does run, its
output no longer silently evaporates the next time an untouched-but-re-scanned file crosses the incremental
path.

**#1611 — opt-in query-time NL term reformulation via Haiku CLI — implemented, then unwound (2026-07-04, see
"Direction decision" above; this write-up is kept for record only, none of this code exists on the branch
anymore)**
Chosen over wiring the `keywords` field because it never touches the graph's own nodes/edges — no diluted
connections, fully reversible per query, zero risk to graph structure. Mechanism: `graphify query "..."
--reformulate` (or `GRAPHIFY_QUERY_REFORMULATE=1` to default it on) shells out to `claude -p --model haiku`
(via the locally-installed Claude Code CLI, no separate API key needed) with a terse system prompt asking
for 3–8 pipe-delimited candidate terms — the same move an engineer's own first `grep -E 'a|b|c'` makes
before skimming results, instead of grepping the literal question text. Output is content-hash-cached per
exact question text under `graphify-out/cache/query_reform/`, so a repeated question costs nothing and
returns byte-identical terms on repeat (no LLM sampling re-roll). Extra terms are unioned into the existing
term list, so they flow through #1445's per-term seed guarantee exactly like literal query words — a bad
reformulated term can only add a noise seed, never starve out a real match. **Off by default** — adds real
per-query latency (~2-15s observed) and Claude Code subscription usage, unlike the free deterministic
literal-term path.

**Real bug found and fixed during live verification, not from source review:** the first live test against
this repo's graph returned `None` — `claude -p` was inheriting this project's own CLAUDE.md/hooks and
attempting to actually invoke a `Bash` tool to run `graphify query` itself, which under
`--no-session-persistence` has no way to grant permission and returned a permission-denied question instead
of terms (~15s wasted, no error surfaced to the caller). Fixed by adding `--tools ""` to the CLI invocation
— this is load-bearing, not cosmetic; without it, any `claude -p` call made from inside a directory with its
own CLAUDE.md/hooks can go agentic instead of answering directly. **Worth remembering if extending this
pattern elsewhere in the fork.**

**Scope:** improves *which terms seed the traversal*. Does not by itself fix output ranking — see #1612.

**#1612 — BFS/DFS `query` output ranked by relevance, not raw degree
(`graphify/serve.py::_subgraph_to_text`, wired through `_query_graph_text`)**
Root cause: `_subgraph_to_text` has always supported a `seeds` param to render seed nodes first — but
`_query_graph_text` was its **only caller in the entire codebase**, and never passed it. Every `graphify
query` result silently fell back to pure whole-graph degree-sort, which is why the same generic hubs
(`vitest.ts`/`schema.ts`/`container.ts`/`config.ts`/`logger.ts`) led the output in every test done in this
investigation, regardless of what #1445 or #1611 did upstream to improve seeding. Fix: `_query_graph_text`
now passes both `seeds=start_nodes` (seeds render first) and `scores=scored` (the same per-node relevance
scores `_score_nodes` already computed to pick seeds, now also used to rank the non-seed expansion — a node
that matched a query term outranks an unrelated high-degree hub instead of losing to it outright). Nodes
absent from `scores` (no term overlap) fall back to degree exactly as before — strictly additive, verified
byte-identical to pre-fix ordering when `scores` is omitted (regression test:
`test_subgraph_to_text_without_scores_falls_back_to_degree_sort_unchanged`).

**This is the largest observed improvement of the four query-side fixes.** Seeding fixes (#1445, #1611) were
necessary but not sufficient — the seeds they carefully selected were being computed correctly and then
discarded before rendering. Regression tests: no-scores-unchanged, scores-promote-relevant-over-higher-degree-hub,
dict/list score input equivalence, and one end-to-end test through `_query_graph_text` itself (the
standalone `_subgraph_to_text` tests can't catch a caller forgetting to pass the param — which is exactly
how this bug happened and sat unnoticed).

**#1613 — `explain` surfaces ambiguous/precedence-collapsed matches instead of guessing
(`graphify/serve.py::_find_node_tiers`, wired through `graphify explain` in `graphify/__main__.py`)**
Root cause: `explain` had the identical single-committed-guess bug #1445 fixed for `query`'s seeding, in its
own resolution step, never previously addressed. `_find_node` already computed a full tier-ordered candidate
list (source-path-exact, exact, prefix, substring) — the disambiguation data existed — but `explain`'s CLI
handler took `matches[0]` unconditionally and discarded the rest with no signal. Confirmed live against the
real repro: `explain "genres"` returned a degree-1 Storybook literal while `GenresResponse` — the node
Trial 1's ground truth said was relevant — sat one tier down (`exact` vs `prefix`), fully hidden by tier
precedence. This is a different shape than a same-tier tie: the top tier had exactly *one* match, so a naive
same-tier-count check would have missed it entirely (verified: it did, on the first implementation attempt).

Fix has two parts, both gated behind `_find_node_tiers` (new function, same matching logic as `_find_node`
plus tier boundaries and whether the pre-existing file-level-node heuristic already resolved a multi-entry
`source_exact` tier):
- **Same-tier ties**: more than one candidate in the top precedence tier → list them all instead of picking
  one.
- **Precedence collapse**: exactly one candidate in the top tier, but it's weakly connected (degree ≤ 1) and
  a lower tier has candidates fully hidden by precedence alone → list the lone top candidate plus the lower
  tier's candidates together.

**Degree-dominance escape hatch, added after live testing exposed a false positive:** the initial same-tier
check flagged every multi-entry tier as ambiguous, which broke `explain "Cradle"` in this repo — 3 distinct
nodes are legitimately labeled `Cradle` (the real DI container definition, degree 31, plus two unrelated
per-file parameter-type annotations, degree 4-5 each). That's not a real ambiguity; one candidate obviously
dominates. Added a degree-dominance check (mirrors `path`'s existing top-vs-runner-up gap-ratio warning,
applied to degree instead of score): when the top candidate's degree is at least ~3x the runner-up's, resolve
directly to it — and to the *actual* highest-degree node, not just whatever `matches[0]` happened to be by
iteration order, since tier order isn't degree-sorted.

`--force` bypasses the guard entirely, reproducing pre-#1613 behavior for scripts that want it. Verified live
against the real repo: `explain "genres"` now lists both candidates; `explain "Cradle"` and
`explain "identityResolutionJob"` (the two previously-clean cases documented in the original experiment)
are unaffected — confirming the fix is narrowly scoped, not a general "always show more candidates" change.
Regression tests (`tests/test_explain_cli.py`): same-tier ambiguity, `--force` bypass, unambiguous baseline,
the pre-existing source-file-preference interaction (caught a real regression during development — see
commit message), precedence collapse, degree-dominant resolution (real-repo shape), and close-degree ties
still flagged. Full suite (2764 tests, same 1 pre-existing unrelated failure) and ruff pass.

**Scope:** fixes `explain` only. See #1614 immediately below for `path`.

**#1614 — `path` surfaces ambiguous endpoint matches instead of warning-and-guessing
(`graphify/__main__.py`, port of #1613 into `path`'s `_score_nodes`-based endpoint resolution)**
`path` doesn't use `_find_node_tiers` (it resolves endpoints via `_score_nodes`'s flat IDF-weighted score
list, a different mechanism than `explain`'s tiered lookup), so this isn't a code-sharing port — it's the
same *fix shape* applied to a different resolution mechanism. `path` already had a top-vs-runner-up
score-gap check, but it only printed a stderr warning and then silently proceeded with the top-scored
candidate regardless — confirmed live, this fired on the exact known-bad repro
(`path "filterRegistry" "useMediaLookups"`) and did nothing to stop the bad result. Root cause once traced:
**both endpoints were individually resolving correctly** even before this fix — `filterRegistry.ts` (degree
21) and `filterRegistry.test.ts` (degree 8) were tied at the *identical* score, and a stable sort tiebreak
(shorter label wins) happened to silently pick the right one. The bad *path* itself came from a second,
separate cause: once both endpoints resolve, the shortest route between them in this graph genuinely goes
through shared test-infrastructure imports (`vitest.ts`), which is graph-theoretically correct but
semantically meaningless — that part is **not** fixed here (see backlog item 1).

The endpoint-resolution part is fixed: a close score gap is now a hard ambiguity gate (numbered candidate
list: label, source, degree, score) instead of a warning nobody has to act on, with the same
degree-dominance escape hatch as #1613 (applied to the pre-existing score-gap check rather than tier
membership) so a real dominant symbol still resolves directly. `--force` bypasses. Regression tests
(`tests/test_path_cli.py`): tied endpoint surfaces both candidates, degree-dominant endpoint resolves
directly, `--force` bypass, and the original #849 unambiguous fixture is unaffected. Full suite (2768 tests,
same 1 pre-existing unrelated failure) and ruff pass. Verified live: the repro now lists both tied
candidates; `--force` reproduces the old (silently-lucky) result for comparison; a genuinely unambiguous
path (`identityResolutionJob` → `plexProvider`) resolves directly to a real 3-hop production-code route.

## Direction check: retrieval-side fixes vs. ingestion-side (user's stated view)

All of #1445/#1610/#1611/#1612/#1613/#1614 are retrieval-side — they change how existing graph content is
matched, ranked, and disambiguated, not what content the graph contains. The user's stated view, going into
the next round of work: **graph ingestion (extraction-side) is higher leverage than further query
optimization** — echoes the root-cause findings above (`keywords` field never written, no embedding tier)
being about what gets *into* the graph, not how it's read back out. Explicit constraint given alongside that
view, to weigh before implementing: **keyword/relationship generation from semantic extraction must be
tightly controlled** — a strong, real edge must not get buried under a large generated keyword set the same
way a weak/incidental edge does; the two should not receive equal-weight vocabulary. This directly informs
backlog item 3 (`keywords` field) below — it should not be "generate 3-5 keywords per node uniformly," but
something that scales keyword *quantity or weight* with the underlying edge/node's actual structural
strength (e.g. degree, confidence, community centrality), so ingestion doesn't reproduce the same
"everything scores about the same, precision is lost" failure mode retrieval-side fixes have spent this
whole document unwinding.

## `keywords` field design (#1615 candidate) — shelved (2026-07-04)

**Status: design only, zero code written, and now paused — not being actively pursued.** Superseded in
priority by the "Direction decision" at the top of this doc: this design's core mechanism is an LLM
generating keywords at ingestion time, the same generative-AI lever #1611 tried at query time and was
unwound for (cost/latency/non-determinism for retrieval-side gain the deterministic fixes already deliver
most of). The design work below is preserved as-is in case it's revisited later, but it is **not** the next
thing to build. If picked back up, re-confirm the direction with the user first rather than resuming from
where this left off. The rest of this section is the design as it stood before shelving, unedited.

~~This is now the user's stated top priority (promoted above the Trial 1/2 re-run)~~ — no longer current;
see above. It has a real architectural sequencing problem discovered mid-investigation that must be resolved
before writing `llm.py`/`build.py` changes — do not start coding from this section without reading the
blocker below first, and without first re-confirming this is still the direction the user wants.

**Decided (via AskUserQuestion, both recommended options taken):**
- Keyword *count* per node scales in 4 degree-based tiers, floor 0, grounded in this repo's real degree
  distribution (3,718 nodes; median degree 1; p50=1, p75=2, p90=7, p95=13, p99=30, max=142 — same
  heavily-right-skewed shape `_bfs`'s existing `hub_threshold` percentile logic already assumes):
  degree 0–1 (69% of nodes, e.g. the "GENRES" Storybook literal) → **0 keywords**; degree 2–6 → **1**;
  degree 7–29 → **2–3**; degree 30+ (top ~1%, true hubs) → **3–5**.
- Confidence (EXTRACTED/INFERRED/AMBIGUOUS on incident edges) is explicitly deferred — degree-only for the
  first cut, confidence as a future tier-demotion modifier, not blocking this work.
- **How weighting works, resolved:** no new weighting system needed. `_compute_idf` (`serve.py:133-155`)
  already discounts any text token that appears on many nodes, regardless of which field it came from — it
  operates on whatever `_node_search_text` concatenates. If generated keywords get appended into
  `_node_search_text` alongside `norm_label`/`label_tokens`/etc., a keyword that turns out generic and
  shared across many nodes is automatically down-weighted by the *existing* IDF machinery the same way an
  overused literal word already is. The user's count-scaling (volume: how many keywords a node earns) and
  IDF (weight: how much any single matched keyword counts once found) are orthogonal axes that compose for
  free — this was the "does my idea align with the existing approach" question, resolved: yes, adopt the
  count-scaling as stated and route through the existing pipeline rather than building a second one.

**Open blocker, found while investigating the merge pipeline (not yet resolved):**
Degree is a **whole-graph property** — it doesn't exist until after AST + semantic extraction from all
files are merged into one graph (`build.py`). But the LLM semantic pass runs *per file/chunk*, in isolation,
before that merge happens. So "ask the LLM to generate N keywords, where N depends on this node's eventual
degree" is not directly possible — the LLM cannot know the degree of a node it is helping to create.

Sketch of the fix, **not yet built or verified**: (a) the LLM generates keywords during its normal per-file
pass without a degree-aware count — just a small bounded pool (e.g. "up to 5 plain-English aliases/synonyms,
when genuinely applicable, don't force it for trivial nodes"), capped at the global max tier size so a
single call can't go overboard; (b) a **deterministic, non-LLM** post-processing step, added after the graph
is fully assembled and real degree is known, truncates each node's `keywords` list down to the degree-tier
budget from above. `export.py::to_json` is the natural insertion point — it already computes `norm_label`
per node immediately before writing `graph.json`, with the fully-built `G` (and therefore `G.degree(nid)`)
already in scope at that point. This keeps the expensive part (one LLM call) as a single pass — no second
LLM round-trip, consistent with the "cheaper" goal — and makes the actual precision control (the thing the
user is protecting) a cheap, deterministic, fully-testable Python function with no LLM involved at all.

**Second, deeper problem found while checking whether this can even attach keywords to real AST symbols
(the highest-value case — e.g. getting `IdentityResolutionJob` itself more findable, not just some
LLM-invented concept node about it):** `build.py`'s existing "ghost-duplicate" merge mechanism
(`build.py:428-497`, `_ghost_remap`) is the established pattern for reconciling an LLM-emitted node with its
AST canonical counterpart when they describe the same symbol under different IDs — this is exactly the
mechanism a `keywords`-bearing LLM node would need to ride to end up attached to the real AST node. But as
read so far, when a ghost is identified (`_loc_nodes`/`_noloc_nodes` matching by `(basename, label)`), the
merge does `G.remove_node(ghost_id)` — **the ghost's entire attribute dict is discarded**, not selectively
merged onto the surviving AST node. If the LLM's `keywords` field lives on the ghost node (as it naturally
would, since the LLM doesn't know the AST-assigned ID), it would currently be silently deleted by this exact
merge step, before `keywords` ever reaches a real symbol. This has **not been traced further or confirmed**
whether NetworkX's node-attribute semantics elsewhere in the file would preserve it some other way — the
next session should re-read `build.py` around the `G.remove_node(ghost_id)` call (line 487) and the
preceding attribute-assembly logic to confirm this precisely before assuming the fix is "just don't discard
the ghost's `keywords` field."

**Concrete next steps for whoever picks this up:**
1. Confirm the ghost-discard behavior precisely (read `build.py:380-490` in full, not just skimmed).
2. If confirmed, add a narrow fix: before `G.remove_node(ghost_id)`, copy `keywords` (only that field, not
   the whole ghost attribute dict — everything else should keep "AST wins") onto `G.nodes[ast_id]`.
3. Write the degree-tier truncation function (pure Python, unit-testable without any LLM — deterministic
   input/output, exactly the kind of fix this session has been able to verify cleanly) and wire it into
   `export.py::to_json`.
4. Wire `keywords` into `_node_search_text` (`serve.py`) so the trigram index + `_score_nodes` + existing
   IDF pick it up with no new scoring logic.
5. Add the `keywords` field to `llm.py`'s extraction system prompt/schema, capped at the global max (5), with
   guidance not to force keywords onto trivial/low-value nodes.
6. This cannot be live-verified the deterministic way #1610–#1614 were (grep/CLI output, byte-for-byte
   comparable) — it needs either a real `GEMINI_API_KEY`/`GOOGLE_API_KEY`, or the `claude -p` CLI path
   (`--tools ""`, same pattern as #1611), run against real files, to judge actual keyword quality. Budget for
   that differently than the previous fixes' turnaround.

## Not yet implemented (further backlog, lower priority than the above)

1. **`path`'s remaining gap: shortest-path traversal itself, not endpoint resolution.** #1614 fixed silently
   guessing between tied endpoints; it did not fix a *correctly resolved* pair still routing through
   irrelevant test-infrastructure edges because that happens to be graph-theoretically shortest. Candidate
   fix shapes: weight/deprioritize edges whose `source_file` is a test file during `path`'s shortest-path
   search (not deletion — just deprioritization, since test-file edges are sometimes exactly what's asked
   for); or surface the *k* shortest paths instead of only the single shortest one, so a caller can see the
   test-only route isn't the only option. Not yet scoped at the source level.
2. ~~Re-run the Trial 1/Trial 2 planning-task methodology with the fork installed~~ — **done, 2026-07-04**,
   see `docs/experiments/graphify-vs-docs-2026-07-01/trial-5-deterministic-fork-retest.md`. Result: cost
   still goes up with the graph (+38% tokens, +2.3x wall time on a fresh task), for a real but modest quality
   edge (one concrete catch a docs-only plan missed, one ambiguity correctly resolved rather than flagged) —
   not a categorical win either way at this repo's scale. Reproduces Trial 3's cost finding with the clean
   fork instead of ad hoc patches.
3. Local embedding tier over node labels/summaries only (not file content) as a 4th matching tier, tried
   only when exact/prefix/substring return nothing — keeps the existing fast/free path for exact-term
   queries untouched. Same weighting-precision concern as the `keywords` design above applies if this is
   revisited.
5. Make `graphify update .`'s code-only path itself cheaper to run *with* semantic coverage — not by
   calling an LLM more often, but by making cache hits (via #1610) the common case: e.g. periodically warm
   the semantic cache with a deep rebuild, so incremental updates thereafter stay free and keep their
   semantic layer. Currently neither hooks nor CLAUDE.md instruct any periodic deep rebuild at all.
6. Apply the same `seeds`/`scores`-forwarding audit to any other `_subgraph_to_text`-adjacent call sites
   that get added later — #1612 was a single-call-site bug, but the pattern (a ranking param that exists
   but nothing passes) is worth a lint/test-coverage check so it can't recur silently.
7. The MCP server's `_tool_get_node` (`serve.py`, distinct from the CLI `explain` path) has its own separate,
   naive substring-matching logic that doesn't even call `_find_node`/`_find_node_tiers` — out of scope for
   #1613 (which only touched the CLI), noted here so it isn't mistaken for already covered.
8. Not yet pushed to `origin` or opened as a PR against `upstream` (`safishamsi/graphify`). Do this once
   there's more confidence than individual-query re-validation gives — item 2 above (Trial 1/2 re-run) is
   the natural gate.
