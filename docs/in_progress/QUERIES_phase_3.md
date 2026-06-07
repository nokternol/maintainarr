# Phase 3 — Combination Model Backend

**Repo:** `/home/nokternol/repos/sandbox`  
**Prerequisite:** Phase 2b shipped (`saved_query.mediaType` refactor — queries are typed before combination model runs)  
**Blocks:** Phase 4  
**Status:** BLOCKED on Phase 2b

---

## What this phase is and why

Replaces the current `automation.queryId` (one FK to one saved query) with a multi-query
combination model. An automation can reference multiple saved queries, each assigned a role
of `include` or `exclude`. The execution result is:

```
union(all include sets) − union(all exclude sets)
```

This lets a user express "delete movies matching Query A unless they also match Query B"
without encoding negation logic into a single query.

**v1 model: include/exclude two-column** (not a full boolean expression tree).  
This covers the dominant use case. Full boolean tree with parentheses is deferred to v2.

---

## Context window strategy

Three discrete work units, each independently committable:

**Session A — Schema + migration:** Steps 3.1–3.2  
**Session B — Combination evaluator + executor update:** Steps 3.3–3.4  
**Session C — API update + regression:** Steps 3.5–3.6

The migration (Step 3.1) is the highest-risk step — it must backfill existing `queryId` rows
into `automation_query_sources` before the old column can be dropped. By the time Phase 3 runs,
`saved_query.mediaType` already exists (added in Phase 2b), so each backfilled source row carries
an implicit type via the query it references. Run the full test suite before and after.

Use a haiku subagent to read the existing migration files and `automationService.ts` to
understand current patterns before writing any new code.

Test runner: `yarn vitest run --project server`

---

## Files involved

### New files
| File | Purpose |
|---|---|
| `server/database/migrations/0006_automation_query_sources.sql` | New join table; backfill; drop old column |
| `server/services/combinationEvaluator.ts` | Set algebra: union(includes) − union(excludes) |

### Modified files
| File | Action |
|---|---|
| `server/database/schema.ts` | Add `automationQuerySources` table definition; update `Automation` type |
| `server/services/automationService.ts` | Read/write via `automation_query_sources` |
| `server/services/automationExecutor.ts` | Load query sources; evaluate each; combine |
| `server/modules/automations/automations.handler.ts` | Accept `querySources` array in create/update |
| `server/modules/automations/automations.routes.ts` | Validate `querySources` schema |

---

## Step 3.1 — Migration: add `automation_query_sources`, backfill, drop `queryId`

```sql
-- 1. New join table
CREATE TABLE automation_query_sources (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  automationId  INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  queryId       INTEGER NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK(role IN ('include', 'exclude')),
  sortOrder     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_aqsources_automation ON automation_query_sources(automationId);

-- 2. Backfill: migrate every existing automation's single queryId to an include row
INSERT INTO automation_query_sources (automationId, queryId, role, sortOrder)
SELECT id, queryId, 'include', 0
FROM automations
WHERE queryId IS NOT NULL;

-- 3. Drop old column (SQLite requires recreating the table)
-- Use a rename-copy-drop pattern; see existing migrations for the convention used in this repo.
```

Check `server/database/migrations/` for the naming convention and any existing table-recreation
patterns before writing Step 3 of the migration.

After migration: run `yarn vitest run --project server` and confirm all existing automation
tests pass before proceeding.

---

## Step 3.2 — Schema: add `automationQuerySources` Drizzle definition

In `server/database/schema.ts`, add:

```ts
export const automationQuerySources = sqliteTable(
  'automation_query_sources',
  {
    id:           integer('id').primaryKey({ autoIncrement: true }),
    automationId: integer('automationId').notNull()
                    .references(() => automations.id, { onDelete: 'cascade' }),
    queryId:      integer('queryId').notNull()
                    .references(() => savedQueries.id, { onDelete: 'cascade' }),
    role:         text('role').notNull(),           // 'include' | 'exclude'
    sortOrder:    integer('sortOrder').notNull().default(0),
  },
  (table) => [index('IDX_aqsources_automationId').on(table.automationId)]
);

export type AutomationQuerySource     = typeof automationQuerySources.$inferSelect;
export type NewAutomationQuerySource  = typeof automationQuerySources.$inferInsert;
```

Update `AutomationService` to load `querySources` alongside each automation.

---

## Step 3.3 — `CombinationEvaluator`

New file: `server/services/combinationEvaluator.ts`

```ts
export type ItemId = number | string;

export interface QueryResult {
  role: 'include' | 'exclude';
  items: ItemId[];
}

export function evaluateCombination(results: QueryResult[]): ItemId[] {
  const includes = results.filter(r => r.role === 'include').flatMap(r => r.items);
  const excludes = new Set(
    results.filter(r => r.role === 'exclude').flatMap(r => r.items)
  );
  return [...new Set(includes)].filter(id => !excludes.has(id));
}
```

TDD this function directly — it has no dependencies and is pure. Tests:
- Two include sets → union (deduped)
- One include, one exclude → difference
- Item in both include and exclude → excluded (exclude wins)
- Empty includes → empty result
- Empty excludes → all includes returned

---

## Step 3.4 — `AutomationExecutor` update

Current `execute(automationId)` fetches one provider's data and applies a single query's
filters. New execution sequence:

```
1. Load automation → load all automation_query_sources (include + exclude)
2. For each query source (can be parallelised per role group):
   a. Load the saved query's filters
   b. Fetch media from the automation's provider
   c. Apply Tier 1 in-memory filters
   d. Load enrichment rows for surviving items
   e. Apply Tier 2 enrichment filters
   f. Collect surviving item IDs → QueryResult { role, items }
3. Pass all QueryResults to CombinationEvaluator.evaluateCombination()
4. Execute the automation's task on the final item set
```

The `execute(automationId)` signature does not change — backward compatible.

---

## Step 3.5 — API: accept `querySources` in create/update

Update the automation create/update request schema to accept:

```ts
querySources: z.array(z.object({
  queryId:   z.number().int().positive(),
  role:      z.enum(['include', 'exclude']),
  sortOrder: z.number().int().optional().default(0),
})).min(1)
```

The old `queryId` field on the request body is deprecated — continue accepting it for one
version as a migration aid (convert to a single `include` source if present, `querySources`
not provided).

---

## Step 3.6 — Regression

Run the full test suite. Specifically verify:
- Existing automations created before this migration continue to execute correctly
- `AutomationScheduler` still seeds correctly on startup
- A new automation with one include + one exclude source produces the correct filtered set

---

## Cross-type combinations

Phase 2b adds `mediaType` to `saved_queries`. Each `automation_query_sources` row therefore
references a query with a known type. Phase 3 must decide the policy for cross-type combinations
(e.g. an include source that is `movie` and an exclude source that is `series`):

**Recommended policy for v1:** Reject cross-type combinations at creation time — all query sources
in an automation must share the same `mediaType`. This keeps the executor's branching model intact
(one provider type, one filter function). Cross-type compositions are deferred to a future phase
where the executor is redesigned for multi-source fetching.

---

## Acceptance criteria

- `automation_query_sources` table exists and contains backfilled rows for all existing automations
- `automations.queryId` column is removed
- All query sources in an automation must share the same `mediaType` (validated at creation time)
- `AutomationExecutor` evaluates multiple query sources and combines them correctly
- Automation with one include + one exclude applies DIFFERENCE semantics
- Automation with two include sources applies UNION (deduped) semantics
- All existing automation tests pass
- `execute(automationId)` signature is unchanged
