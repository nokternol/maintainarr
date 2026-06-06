# Claude Instructions

## Process hygiene

Always stop any server or dev process you start before ending your response. This includes:

- `yarn dev` (Next.js)
- `yarn ladle` (Ladle component server)
- `npx tsx server/index.ts` (Express server)
- Any other long-running process started during the session

Use `pkill -f "<process pattern>"` or track the PID at start and kill it explicitly. Do not leave background processes running — the user will find stale `yarn dev` or `yarn ladle` instances after every session otherwise.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
