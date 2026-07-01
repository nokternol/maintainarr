# Follow-up investigation: why did graphify underperform in Experiment 1?

The result of Experiment 1 (docs-only plan beat the graph-assisted plan on both quality and cost) was
unexpected and warranted direct verification rather than acceptance at face value. This section documents
what was actually checked, with evidence, before drawing any conclusion.

## Was the copied graph stale or incomplete?

`graphify-out/` is gitignored, so it was copied wholesale (52MB) from the live repo into the `with-graph`
clone rather than rebuilt from scratch. A timestamp check on `graph.json` showed the clone's copy was
about 30 minutes older than the live repo's current state at write-up time — but that gap is attributable
entirely to *later* git operations performed in the live repo while compiling the Experiment 1 report
(branch switches triggered new auto-rebuilds), not to anything missing at copy time. The clone's graph was
a faithful, current snapshot relative to the code it was paired with. Staleness from the cloning process
itself is ruled out as the cause.

## Direct evidence of the failure mode

Two of the same query types the Experiment 1 worker used were re-run directly against the copied graph
for verification:

```
$ graphify explain "genres"
Node: GENRES
  Source: MediaFilterBar.stories.tsx L34
  Degree: 1
  Connections (1): <-- MediaFilterBar.stories.tsx [contains]
```

This resolved to a Storybook string literal, not the actual `genres` rule in `filterRegistry.ts` or its
relationship to `useMediaLookups.ts` (the hook that populates it dynamically — the fact the graph-assisted
worker needed and never found). Multiple things in this repo are named "genres"; the tool picked one at
essentially random, and it was the least useful one.

```
$ graphify path "filterRegistry" "useMediaLookups"
warning: source match was ambiguous (top score 715.143, runner-up 715.143)
Shortest path (6 hops): filterRegistry.test.ts --imports--> NormalizedShow
  <--imports-- automationExecutor.test.ts --imports--> server
  <--imports-- media.page.test.tsx --imports_from--> index.tsx --imports--> useMediaLookups()
```

Graph-theoretically valid, architecturally meaningless — six hops through unrelated test files, not the
one-hop fact ("genres' values come from this hook") that mattered. The edges being traversed are raw
`imports`/`contains` relationships: the same information `grep -rn "import.*useMediaLookups"` gives
directly, with no weighting for relevance.

## The mechanism, per the tool's own rebuild log

`~/.cache/graphify-rebuild.log` shows the automatic post-commit/post-checkout hooks perform AST-only
extraction ("no LLM needed," per the tool's own CLAUDE.md documentation) — imports, contains, references.
The log also shows repeated `WARNING: refusing to overwrite` on what the tool calls the "curated" graph
pass — the presumably richer, semantically-weighted layer that would differentiate this tool from a plain
import graph. That pass was not landing cleanly in the period covered by the log. In practice, the graph
the worker queried was close to a bare AST import graph, not the enriched version the tool advertises.

## Why the docs-only agent matched on cost and won on completeness

The actual "find every touch point" question in Experiment 1 was answerable exhaustively by
`grep -rn "dataType"` alone — roughly 500 files, one consistent identifier, no divergent naming across
layers. A precomputed import graph does not compress that further than grep already does; this is why both
agents converged on the same core touch points in a similar budget.

The completeness gap came from something the graph didn't provide and grep didn't require: the docs-only
agent read `src/hooks/*.ts` as a full directory sweep out of general thoroughness, and hit
`useMediaLookups.ts` "on the way" — not because any doc or query pointed there directly. The graph-assisted
agent trusted its `explain`/`path` results as a reasonably complete relevance map; because those results
were the noisy output shown above, nothing ever signalled it to go read that file. The imprecision didn't
just fail to help — it displaced the brute-force sweep that would have closed the gap.

## What this does and doesn't show

For a repo this size (~500 files), with consistent naming, this result supports the claim that plain
markdown docs plus ordinary grep/read exploration matched — and in this trial beat — the graph tool, at
comparable cost. It does not show that no task benefits from a knowledge graph. The graph's edges observed
here were structural (imports/contains), which is exactly the category of information grep already
retrieves for free when identifiers are consistent. A fair test of the tool's actual value proposition
needs a task where:

1. **Names diverge across layers** — no shared substring connects cause and effect, so grep cannot find
   the link but a precomputed edge already would.
2. **Scale defeats brute force** — a codebase large enough that an exhaustive grep sweep is too
   expensive/noisy to run, unlike this repo where it was effectively free.
3. **Wiring is non-textual** — relationships established by DI/config/reflection rather than static
   imports, if the tool's AST extraction actually models those as edges (worth verifying, not assuming).

A quick positive counter-check supports criterion 3 specifically: `graphify explain "Cradle"` (the
awilix DI container's root type, `server/container.ts:29`) resolved cleanly to a single, unambiguous,
richly-connected node (degree 32, real consumers: `AutomationService`, `MediaQueryEngine`,
`ProviderFactory`, route files, etc.) — a sharp contrast to the "genres" dead end. `mediaIdentity`
(degree 16) and `IdentityResolutionJob` (degree 9) resolved with the same precision. This suggests the
tool's node/edge quality is not uniformly bad — it is bad specifically where a name is ambiguous or where
the graph has no distinguished node to anchor on, and good where a concept has one clear, structurally
central definition. Experiment 2 is designed around that distinction.
