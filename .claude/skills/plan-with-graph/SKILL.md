---
name: plan-with-graph
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the concept, run `graphify query "<question>"`, `graphify explain "<concept>"`, or `graphify path "<A>" "<B>"` against `graphify-out/graph.json` instead of asking me. Use the graph's answer as your recommended answer, and only surface it to me if the graph's answer conflicts with what I've described — that conflict is the most important thing to grill on, because it means user intent and the current shared model are misaligned. Do not use `graphify save-result`/`reflect` or read `LESSONS.md` — corrections filed that way get folded into every later session's context by default, for every topic, whether or not they're actually relevant; that's an unreviewed, accumulating nudge on the graph, not a deliberate one. If a query returns something wrong, empty, or ambiguous, just fall back to a direct file read to get the real answer — don't log it anywhere for a future session to inherit unprompted.

As understanding is reached on each branch, assess whether the graph currently reflects it. Where it does not:
- Write the documents, design notes, or structured files needed to make it discoverable — not a list of things to write, the actual files
- **Every time a doc names a real code symbol or file this session's understanding depends on, mark it explicitly** — `[display text](ref:label:ExactNodeLabel)` for a symbol, `[display text](ref:path:relative/path/from/repo/root.ts)` for a whole file. Do not rely on plain backticks alone; graphify's own extraction never creates edges from a prose mention of code, no matter how it's formatted — this explicit markup is the only thing the linker below acts on, deliberately, so it never has to guess whether a backtick span is illustrative code, a label, or a path.
- **The post-commit hook does not fold docs into the graph — it explicitly skips them.** After writing/updating a doc and committing it, run
  `python3 .claude/skills/plan-with-graph/link_doc_to_code.py <doc-path> --apply`
  for every doc this session touched. This only adds edges between nodes that already exist (it never creates a node, so it can't collide with graphify's own extraction/merge), and it's idempotent — safe to re-run any time the doc changes, in this session or a later one; it replaces only its own previously-written edges for that file before adding fresh ones. If a doc references code graphify hasn't ingested yet (new file, or doc written before any build/update ran), the script says so explicitly rather than silently doing nothing — run a normal graphify build/update first so the target node exists, then re-run the linker.

If user intent is found to diverge from what is actually built, surface that as a concrete finding. A plan to close the gap may be produced where appropriate — but it is a consequence of the session, not its goal. The goal is a graph that accurately reflects the converged understanding of what Warden is, why it is built this way, and how its parts relate.
