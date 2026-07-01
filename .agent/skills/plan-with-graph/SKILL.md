---
name: plan-with-graph
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the concept, run `graphify query "<question>"`, `graphify explain "<concept>"`, or `graphify path "<A>" "<B>"` against `graphify-out/graph.json` instead of asking me. Use the graph's answer as your recommended answer, and only surface it to me if the graph's answer conflicts with what I've described — that conflict is the most important thing to grill on, because it means user intent and the current shared model are misaligned.

Before asking the first question, run `graphify reflect --if-stale` and read `graphify-out/reflections/LESSONS.md` if it exists — it may already record a prior session's corrections for this exact topic, including cases where a graph query returned the wrong thing. Then silently query the graph for existing context on the topic. Use what you find to ground the questions — do not ask me to re-establish what the graph already reflects accurately.

**Every graph query in this session is a labeled data point, not just an answer.** The graph's retrieval is lexical: it finds a node whose label/source path textually matches your query terms, not whichever node best matches the *concept* you meant. This fails specifically when I describe something in different words than the code uses, or when a query returns something empty, ambiguous, or that conflicts with what I've said. When that happens:
- Don't just silently retry with different wording and move on — call `graphify save-result --question "<the exact query that failed>" --answer "<what the graph returned>" --outcome dead_end --nodes <node-id-if-known>` before retrying.
- Once we converge on the correct answer (from me, or from further exploration), call `graphify save-result --question "<the query>" --answer "<the correct answer>" --outcome corrected --correction "<what the right answer was, in my own words>" --nodes <the-correct-node-id>`. **Capture my phrasing itself, not just the resolved fact** — the value of a `corrected` entry is that it's a paraphrase of the node in language the graph doesn't already index, which is exactly the vocabulary gap that caused the miss.
- At the end of the session, run `graphify reflect` once (no `--if-stale`, so this session's corrections are folded in immediately) so the next session — mine or another agent's — starts with these lessons already loaded, not just my restated design docs.

As understanding is reached on each branch, assess whether the graph currently reflects it. Where it does not:
- Write the documents, design notes, or structured files needed to make it discoverable — not a list of things to write, the actual files
- These files become the output of this session and should be committed so the post-commit hook folds them into the graph

If user intent is found to diverge from what is actually built, surface that as a concrete finding. A plan to close the gap may be produced where appropriate — but it is a consequence of the session, not its goal. The goal is a graph that accurately reflects the converged understanding of what Warden is, why it is built this way, and how its parts relate — and, per the above, a `graphify-out/memory/` + `LESSONS.md` trail of every place a query needed correcting, so future retrieval doesn't repeat the same miss.
