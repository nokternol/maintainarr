---
name: docs-lifecycle
description: "Move docs between the intent/, in_progress/, and architecture/ pots correctly — write fresh architecture content, never git-mv-and-retense. Use when closing an in_progress phase, promoting a shipped intent design, hitting a code/doc contradiction, closing a fracture-ledger entry to Healed, relocating/renaming/deleting a file or symbol that any doc references, or changing the behavior of a file that any doc's ref:path: links to."
---

# Docs lifecycle

Three pots, mutually exclusive by status — never describe a built thing as intent:
- **intent** — aspirational, unbuilt, may be thin.
- **in_progress** — staged plan, adjusted as it executes.
- **architecture** — Explanation prose (why it exists, why built this way, decisions baked in),
  code-only `ref:path:`/`ref:label:` links, never doc-to-doc.

## Closing a pot

1. Contradiction between shipped code and the doc, beyond "not written up yet"? Stop → checkpoint below.
2. Write the new architecture content first, citing real code.
3. `git rm` the source (or trim, per checkpoint). Never delete before step 2 exists.
4. Fracture-ledger entry for this, now healed? Flip to Healed, strip *every* linker edge — code or doc,
   `ref:path:` and `ref:label:` alike. Healed is historical narrative, not current-fact graph content.
5. `graphify update .` → `link_doc_to_code.py --apply` on touched docs. Zero dangling `ref:path:` links.
   Skip the LLM semantic-extraction pass.

## Checkpoint — ask the user, never resolve solo

(a) bad plan → delete. (b) real remaining scope → reframe/trim to it. (c) code drifted from plan → new
`in_progress` phase + Open fracture-ledger entry.

## Keeping a linked doc's content honest, not just its links

A resolvable `ref:path:`/`ref:label:` is not proof a doc is accurate — the target can still exist while
the behavior it describes changed underneath it. A valid-but-stale link is *worse* than a dangling one:
the dangling-link check catches broken paths, nothing catches a link that still resolves over wrong
prose. Two triggers, both required, both cheap per-change:

- **Relocating, renaming, or deleting** a file or symbol: `grep -rl <old-path-or-symbol> docs/` across
  *every* pot, not just the docs this change's plan already names as related. Fix or triage every hit.
- **Editing a file's behavior without moving it**: `grep -rl <path> docs/architecture/`; if any doc
  `ref:path:`-links to it, re-read that doc's surrounding prose against your change, not just confirm
  the link still resolves.

Skipping either is how a doc-you-forgot-was-related silently goes stale, one change at a time, across
every phase that doesn't check — which is what a full audit later has to find the expensive way.

## Rules

- No "superseded by X" stubs — narrate history inside the new architecture doc instead.
- Only `fracture-ledger.md`, only while Open, may cite intent/in_progress docs.
- `VOCABULARY.md` trends code-only too; not enforced here.
