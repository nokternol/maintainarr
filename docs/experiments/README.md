# docs/experiments/

Scratch space for one-off investigations (tool evaluations, throwaway trial write-ups, comparison
reports) — not durable project documentation. Contents of this folder are:

- **gitignored** (`.gitignore`: `docs/experiments/*`, this file excepted) — nothing placed here reaches
  git history, so it never needs cleaning up or archiving later.
- **excluded from the graphify corpus** (`.graphifyignore`: `docs/experiments/`) — prose *about* graphify
  or about a tool/approach under test pollutes query/explain results with false-positive matches
  ("Critical", "Judge's scores", etc. surfacing as if they were real project content) when ingested
  alongside real code and architecture docs. Verified: `graphify.detect.detect()` returns 0 files from
  this path regardless of subfolder name.

If a finding from something written here turns out to be worth keeping, promote it out — move the
conclusion into `docs/architecture/` (implemented fact) or `docs/plans/` (an active decision/backlog),
not this folder. This folder itself is never the durable record of anything.
