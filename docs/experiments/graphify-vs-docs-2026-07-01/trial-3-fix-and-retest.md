# Trial 3: patching the actual retrieval bugs and re-testing

Trials 1 and 2 established *that* graphify's retrieval failed and roughly *why* (pure lexical scoring,
no semantic layer). This trial goes one step further: locate the exact functions responsible, patch them,
verify each patch against the two original failing queries, perform the semantic enrichment a
human-curated `plan-with-graph` session would have produced, and re-run the actual worker agent on Trial
1's original task to see whether the fix changes the plan it produces — not just the raw query output.

## 0. Upstream check

Before patching anything locally, the tool's GitHub repo (`safishamsi/graphify`) was checked for existing
reports:

- **#1445** (still open): an independent user reports the identical failure mode on an unrelated
  codebase — vague natural-language queries return confidently-wrong nodes; queries naming an exact
  symbol work. Their own hypothesis matches what direct code inspection confirmed here.
- **#1441** (closed, shipped): a "self-improving work memory" feature — `graphify save-result --outcome
  useful|dead_end|corrected` and `graphify reflect`, which aggregates saved outcomes into a deterministic
  `LESSONS.md`. This shipped in a version newer than what was installed (`0.8.33`).

The tool was upgraded (`uv tool upgrade graphifyy`) from `0.8.33` to `0.9.4` before any local patching, to
avoid re-discovering already-fixed bugs. Both target functions (`_score_nodes`, `_pick_seeds`, `_bfs`) were
confirmed byte-for-byte unchanged from the pre-upgrade version — the seed-diversity and hub-adjacency bugs
identified in the earlier investigation survived the upgrade intact.

## 1. Patches applied (backed up first; see §5 for disposition)

All three patches are in `graphify/serve.py`, the query-time retrieval module. Full diffs are inline code
comments in the patched file; summarized here:

**(a) Per-term seed diversity in `_pick_seeds`.** The original algorithm picks BFS seeds purely by
combined score, then discards any candidate below 20% of the top score. One term's incidental exact-label
match (e.g. "canonical" hitting an unrelated design-token field name) scores 1000x higher than another
term's legitimate substring match, so the 20%-gap cutoff discarded every seed for the query's actually
relevant terms. The patch guarantees at least one seed per distinct query term that has any match at all,
tie-broken by node degree when multiple candidates tie within a term.

**(b) `keywords` field support in `_score_nodes` and the trigram prefilter.** The extraction schema has no
field for anything beyond a node's bare identifier `label` — confirmed by reading the LLM extraction
system prompt directly (`llm.py`), which emits only `{id, label, file_type, source_file, ...}`. The patch
adds an optional `keywords: list[str]` node field, scored at the same three-tier precedence as label
matches (one tier down in magnitude, so a real label match still wins ties). **This alone was a no-op on
first test** — the newer version's trigram prefilter (`_node_search_text`, an optimization added between
0.8.33 and 0.9.4) builds its candidate index from label/source-path text only, silently excluding any node
from scoring consideration before the keywords check ever ran. The prefilter had to be patched too, adding
`keywords` to the indexed text, before the keywords field had any effect. This two-part discovery — patch
looks correct, produces zero change, second patch required — is itself evidence of how brittle this
pipeline is to add semantic signal to.

**(c) Hub-degree threshold recalibration in `_bfs`.** Fixing (a) surfaced a second, previously-masked bug:
with only 1-3 seeds, BFS rarely converged on shared infrastructure; with the corrected 6-11 diverse seeds,
every seed's neighbor list routinely included the same handful of universal modules (DB/config/logger),
flooding the output (260-320 nodes returned, mostly irrelevant). The existing hub-exclusion logic
(`degree >= max(50, p99_of_degree_distribution)`) was intended to prevent exactly this, but on this
repo's graph the polluting nodes sit at degree 33-44 — below the fixed floor of 50. Lowering the floor to
20 (an experimental recalibration, not a principled fix) plus excluding hub neighbors from *inclusion*, not
just from further *expansion* (the original code only stopped hubs being used as a BFS transit node, not
from being added to the result set as a direct neighbor) cut the noise substantially without erasing the
newly-surfaced relevant nodes.

## 2. Verification: before/after on the two original failing queries

**Trial 1 query** (`"how are filter values encoded and decoded in the URL"`) — target: `useMediaLookups`.

| | Before | After all patches + enrichment |
|---|---|---|
| Seeds | `url, url, url` (one term, tripled) | includes `useMediaLookups()`, `useMediaLookups.ts`, `MEDIA_RULES`, `filterRegistry.ts` |
| Target present in output? | No | **Yes** — `useMediaLookups.ts`, `useMediaLookups()`, `MediaTag`, `MediaQualityProfile` all present |

**Trial 2 query** (`"how does linking a Plex library item to a canonical identity record work"`) —
target: `IdentityResolutionJob`/`mediaIdentity`/`enrichmentJob.ts`.

| | Before | After algorithmic patches (no enrichment needed) |
|---|---|---|
| Seeds | `canonical, canonical, canonical` (design-token collision) | includes `identityJobFactory.test.ts`, `PlexProvider` |
| Target present in output? | No | **Yes** — `MediaIdentity`, `enrichmentJob.ts`, `identityResolutionJob.ts`, `IdentityResolutionJob` all present |

Note the asymmetry: Trial 2's target was reachable with the algorithmic patches alone, because a real
(if distant) import-edge path already existed in the graph. Trial 1's target was **not** reachable by any
amount of algorithm tuning, because no import edge connects `filterRegistry.ts`'s `genres` rule to
`useMediaLookups.ts` at all — the relationship is behavioral ("this rule's real values come from that
hook"), not structural. Confirmed directly: `graphify path "filterRegistry" "useMediaLookups"` still
returns the same architecturally-meaningless 6-hop path through unrelated test files, algorithm patches
notwithstanding. Only the manual semantic-enrichment step (adding `keywords` describing the dynamic-vs-
static distinction to the `MEDIA_RULES` and `useMediaLookups` nodes) closed this specific gap. This is the
clearest evidence in the whole investigation for the distinction raised in the follow-up discussion:
algorithmic/retrieval fixes recover connections that structurally exist but are scored wrong; semantic
enrichment is needed for connections that don't exist as edges at all.

## 3. Re-running the actual worker agent, not just the query

The real test isn't whether a hand-picked query returns better nodes — it's whether a fresh agent, given
the same task brief as Trial 1 and told to use graphify as before, now produces a better plan. The
graph-assisted worker was re-run from scratch on the identical `multi-select` dataType task brief, against
the same clone, now patched and enriched.

**Result: the failure from Trial 1 is gone.** The re-run worker:
- Explicitly investigated whether `genres`/`network` (the PM's own suggested examples) were static or
  dynamic, and concluded they are dynamically sourced: *"I explicitly checked whether genres/network...
  would work instead, and they don't fit the 'fixed' requirement... their real values come from provider
  metadata... There's already a scaffolded (but dead) hook, useMediaLookups.ts... This is intent-but-
  unbuilt scaffolding for a dynamic-options picker."*
- Picked `seriesType` as the proof-of-concept — the same, correct answer the original docs-only agent
  reached, and the one the original graph-assisted agent missed.
- Directly credited the graph for originating the correction path: *"graphify's initial query surfaced
  useMediaLookups.ts in the subgraph... a follow-up grep confirmed those endpoints don't exist... That
  combination of graph-surfaced lead + direct file reads + targeted greps is what ruled genre/network out."*

**Cost went up, not down.** Raw metrics: 42 tool calls, ~69,800 tokens, ~318s — more expensive than both
the original graph-assisted run (33 calls / ~72,400 tokens / ~249s) and the original docs-only run (33
calls / ~81,500 tokens / ~259s). The worker's own log shows why: after the graph surfaced the
`useMediaLookups` lead, it did *not* simply trust it — it independently grepped for the provider endpoints
`useMediaLookups` claims to call, confirmed they don't exist server-side, and grepped for consumers to
confirm the hook was dead code, before accepting the conclusion. It also caught and explicitly flagged a
**stale node** in the graph (a reference to `useSavedQueries.ts`, a file that was since renamed/deleted) and
compensated by verifying key claims against real files rather than trusting the graph output alone.

This is the honest, complete picture: the patches and enrichment fixed the *specific* failure (the graph
now surfaces the right lead), but they didn't make the agent faster or cheaper — if anything, having been
burned once by bad graph output in this same repo's history, a careful agent now cross-verifies every
graph-sourced claim against the actual files, which costs more than either trusting the graph blindly (the
original failure) or not using it at all (the docs-only baseline). The value delivered was **completeness
under scrutiny**, not efficiency.

## 4. `plan-with-graph` skill update

`.claude/skills/plan-with-graph/SKILL.md` and `.agent/skills/plan-with-graph/SKILL.md` were updated (kept
in sync) to wire in the `save-result`/`reflect` loop from issue #1441: every graph query that returns a
wrong, empty, or user-contradicted answer during a planning session is now recorded via `graphify
save-result --outcome dead_end`, and the eventual correct answer — critically, in the human's own words,
not just the resolved fact — is recorded via `--outcome corrected --correction "..."`. A `graphify reflect`
run at the end of each session folds these into a durable `LESSONS.md` for the next session to load. This
targets exactly the mechanism validated in §2: a human-in-the-loop session is the richest available source
of the paraphrase/alias data that closes the lexical-vs-behavioral gap, and now has a concrete place to
land.

## 5. Disposition of the local patches

The three `serve.py` patches remain live in the global tool install as of this writing (needed for the
worker re-run in §3). Two are validated, low-risk, and arguably fixes rather than judgment calls (the
per-term seed diversity guard, and the keywords-field/trigram-index plumbing, since node metadata a query
already carries simply wasn't being consulted). The third (lowering the hub-degree floor from 50 to 20) is
an explicit experimental recalibration tuned to this repo's specific degree distribution — it is the
correct call *here* but is called out in its own patch comment as not a principled general fix, since a
lower floor trades away legitimate exploration headroom on smaller or sparser graphs. Recommendation:
keep for continued use on this repo if useful, but do not treat this as a vetted upstream-quality patch;
if it proves valuable, it belongs filed against issue #1445 upstream (which already independently confirms
the underlying bug) for review by the maintainer, not silently carried as a permanent unreviewed fork.

## Conclusion

Given a lead time to actually read the tool's source, patch the two concrete algorithmic bugs, and
perform the semantic enrichment a human-curated session would produce, graphify's retrieval failure from
Trials 1 and 2 is fixable — and fixing it did produce a materially better plan on a live re-run, closing
exactly the gap that mattered. But the fix required: upstream awareness (an open issue already existed),
reading the tool's own source to find two separate, non-obvious bugs (a scoring-tier collision and a
prefilter that silently excluded enriched nodes), and manually authoring the semantic tags that closed the
one gap no algorithm fix could reach. None of that is available to a user running graphify as shipped. The
honest scope of this trial's finding is narrow: **the retrieval architecture is not fundamentally
incapable of surfacing non-obvious connections — it is currently missing exactly the two layers this
trial added by hand (relevance-aware seed diversity, and a semantic/keyword layer with enrichment behind
it) — but neither ships today, and adding them by hand cost more, this time, than not using the tool at
all.**
