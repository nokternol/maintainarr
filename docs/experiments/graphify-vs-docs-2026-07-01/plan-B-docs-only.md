# Plan B

(Method B worker — context-gathering method withheld for blind grading)

## Implementation Plan: `multi-select` rule type (POC: `seriesType`)

### Context that shapes this plan

The codebase is mid-flight on `docs/in_progress/phase-4-client-query-alignment.md` (Stage 2, Cycle 4 done, Cycle 5 "impeccable visual pass" not started). This matters directly: the architecture already has exactly one seam for "declared rule types" — `MediaRuleDescriptor.dataType` — reached through parallel generic codecs on both sides (`server/modules/media/media.handler.ts:coerceRuleValue`/`parseFilterValues`, `src/hooks/useMediaFilters.ts:decodeValue`/`encodeValue`), plus one rendering switch (`src/components/filters/RuleControl/index.tsx`). Adding `multi-select` is "add one more arm to each of these," not a new pipeline. Cycle 5 of the in-progress plan explicitly earmarks "lookup-backed multiselect dropdowns for `csv-ids`/`csv-strings`" as future visual work — that is a *different* concept (dynamic, provider-fetched option lists) from what's requested here (a rule-declared, fixed, static option list). Don't conflate the two; note the distinction in the code/docs so a future agent doesn't merge them incorrectly.

**POC choice: `seriesType`**, not genre/network. Genres and networks are populated by `useMediaLookups.ts` from live provider data (`/api/media/genres`, `/api/media/networks`) — they are not "a fixed set declared once per rule," they're dynamic per-instance lookups, a different feature. `seriesType` is a genuine closed enum (`'standard' | 'daily' | 'anime'`, `server/domain/show.ts:13`) already declared as a `dataType: 'string'` rule with an exact-match predicate — the smallest true fit for "fixed list, currently free text, wrong widget."

### Key design decision: multi-select reuses the existing CSV wire representation

Instead of inventing a new value shape, represent a multi-select's value as the same CSV string genres/network already use (`"standard,anime"`), and change the predicate from exact-match to "item's value is in the selected set" (same shape as the existing `genres`/`network`/`certification` predicates via `parseCsvStrings`). This means:
- **No changes needed** to `FilterValueSchema`/`RangeValueSchema` (schemas.ts) — it's still a plain string.
- **No changes needed** to the URL/browse codecs (`useMediaFilters.ts` encode/decode, `media.handler.ts` `coerceRuleValue`) — their default (non-range/number/boolean) branch already passes the raw string through untouched.
- **No changes needed** to `mediaQueryService.ts` (`coerceValue`/`serializeValue`) — same default-branch pass-through, confirmed by reading the file.
- This is what makes deep-linking/save/reload work "for free": the value is just a string everywhere except the widget that edits it and the descriptor that describes its options.

The only truly new things are: (1) the descriptor needs to carry a fixed `options` list, (2) the rendering widget needs a genuine multi-select control, (3) the predicate needs to become CSV-membership instead of exact-match.

### Files to touch, in order

**1. `server/utils/filterRegistry.ts`** (foundation — do first)
- Add `'multi-select'` to the `dataType` union.
- Add `options: { value: string; label: string }[]` to `MediaRuleDescriptor` (required for `multi-select` rules; can be typed optional on the interface but should always be populated when `dataType === 'multi-select'`).
- Change the `seriesType` rule: `dataType: 'multi-select'`, add `options: [{value:'standard',label:'Standard'},{value:'daily',label:'Daily'},{value:'anime',label:'Anime'}]`, and change its predicate from `show.seriesType === String(value)` to a CSV-membership predicate mirroring `genres`/`network` (`parseCsvStrings(value).includes(show.seriesType)`, guarding `undefined`).
- Verify: this predicate change is behaviour-preserving for single-value inputs (confirmed by reading `filterRegistry.test.ts` and the pinning integration test — both only ever pass a single value like `'anime'`, and CSV-of-one behaves identically to exact-match). Multi-value input is the new capability, untested today.

**2. `server/utils/filterRegistry.test.ts`**
- Update the existing `seriesType — show` test if it currently only asserts single-value cases (it does — confirm it still passes as-is), and add a new case asserting multi-value CSV matches (e.g. `predicate(baseShow, 'anime,standard') === true`).

**3. `src/lib/api/schemas.ts`**
- Add `'multi-select'` to `MediaRuleDescriptorSchema`'s `dataType` enum.
- Add `options: z.array(z.object({ value: z.string(), label: z.string() }).strict()).optional()` to the same schema (it's `.strict()`, so a missed field here means the descriptor either fails validation or silently gets `options` stripped — see risk section).

**4. `tests/mocks/handlers/mediaRules.ts`**
- Add a `multi-select` sample descriptor (with `options`) to `MOCK_MEDIA_RULE_DESCRIPTORS`, consistent with the file's own stated intent ("one per `dataType` so data-driven rendering is exercised across every widget kind").

**5. `src/components/filters/RuleControl/index.tsx`** (the rendering seam)
- Add a `multi-select` branch: render a genuine multi-select (checkbox list or toggle-pill group) driven by `rule.options`, encoding the selected set back to/from the CSV string (join selected values with `,` on change; split on `,` to derive the checked set from the current value).
- Given this repo's UI conventions (existing small single-purpose components like `OptionFilter`), this is likely cleanest as a **new small component** (e.g. `src/components/filters/MultiSelectFilter/`) rather than overloading `OptionFilter` (whose contract is explicitly single-value: `value: T | undefined`, toggle-one semantics). Follow the repo's UI-change convention: story-first (isolated verification), then in-context verification, before final polish.

**6. `src/components/filters/RuleControl/__tests__/RuleControl.test.tsx`**
- Add a `multi-select` test case: given `rule.options`, clicking/checking two options emits the joined CSV string via `onChange`; verify toggling one off again re-emits the remaining value (and `undefined` when the last one is cleared, matching the existing "emits undefined when cleared" convention for text rules).

**7. `src/lib/utils/filterSummary.ts`** (optional but recommended)
- Currently the default branch prints `${label}: ${value}` for any non-boolean/non-range value, so a multi-select CSV value already renders as `Series type: standard,anime` — functional but not pretty. Low-risk polish: split CSV and join with `', '` for a nicer chip/summary if this is user-facing (it is — used in `QueryRow` and the filter bar's active-condition summary). Confirm callers before changing formatting broadly, since this function is shared across all rule types today.

**8. `server/__tests__/integration/mediaRules.integration.test.ts`** and **`media.handler.pinning.integration.test.ts`** / **`media.filter.integration.test.ts`**
- Re-run (not necessarily edit) to confirm the existing single-value `seriesType` assertions still pass under the new CSV predicate. If the pinning integration test's fixture data only has one `seriesType` value being queried at a time, no edits needed — but read them again post-change to be sure order of fixture data didn't implicitly rely on strict equality edge cases.

**9. Docs**
- This is new architecture, not intent — once implemented, it belongs recorded either as an addition to `docs/architecture/media-query-engine.md` (the descriptor's `dataType` vocabulary) or a short new architecture doc. Also update `docs/in_progress/phase-4-stage-2-tdd-handoff.md`'s Cycle 5 notes so the next agent doesn't duplicate this work when it later adds lookup-backed multiselects for `csv-ids`/`csv-strings` — the two are now sibling concepts (`multi-select` = fixed static options; the future `csv-ids`/`csv-strings` lookup work = dynamic options) and the doc should say so explicitly.

### Order of implementation
1. `server/utils/filterRegistry.ts` + its test (server domain, single authority — must be right first).
2. `src/lib/api/schemas.ts` (wire contract).
3. `tests/mocks/handlers/mediaRules.ts` (unblocks client testing).
4. `RuleControl`/new `MultiSelectFilter` component + tests (story-first).
5. `filterSummary.ts` polish.
6. Re-run full integration suite; update in-progress docs.

### Things not fully sure about / would verify before starting
- **Whether `MediaRuleDescriptor.options` should be required-when-multi-select or a plain optional with a runtime guard.** TypeScript can't express "optional except when `dataType === 'multi-select'`" cleanly without a discriminated union, and this registry currently is a flat interface, not a union over `dataType`. A discriminated union would be more correct but is a larger structural change than this POC needs — default to optional + a comment, but flag this to whoever reviews.
- **Whether `filterSummary.ts`'s formatting change for CSV-shaped strings is in scope.** It's shared code touching every string/csv rule's display, not just the new one — worth confirming the PM's UX ask doesn't extend there before touching it broadly.
- **Whether the visual polish pass (checkbox list vs. tag/pill picker, exact interaction model)** should happen now or be deferred like the rest of Cycle 5 — the brief asks for "checkbox/tag picker," which is a genuine design decision (checkboxes vs. removable tag chips), and this is not something to freehand in the hook-logic pass.
- **Exact wording/labels for `seriesType` options** (`Standard`/`Daily`/`Anime`) — inferred Title-Case labels from the raw enum values; would confirm against any existing UI copy convention (did not find `seriesType` rendered as labeled text anywhere in `src/`, only as raw filter param `standard`/`daily`/`anime`).

### What could silently break (no crash, just wrong behavior)
- **The CSV predicate change is a semantic change, not just a UI change.** `seriesType` currently means "exactly this type"; multi-select semantics mean "any of these types." Any existing saved query with `seriesType` (persisted in `mediaQueryFilterValues`) still works identically for single values — but if a user or a bug later writes `seriesType: 'standard,anime'` through some other path (e.g. a raw API call bypassing the UI), it would now silently match more items than "exact equality" implied by the field's TypeScript type comment (`server/domain/show.ts:13` still says it's one of three literal strings — the *item's* field is a single value, only the *filter's* value becomes a set). Worth a code comment at the predicate site making this explicit, since it's the one place the mental model ("one item field, one filter value, same shape") that this codebase leans on now has an asymmetry (item: scalar, filter: set) — that's already true of `genres`/`network`/`certification` today, so it's a precedent, not a new risk, but it's the exact kind of thing that "looks fine, silently wrong" if someone assumes `getRule('seriesType').predicate` still means equality elsewhere (e.g. `automationExecutor` or any other direct `MEDIA_RULES` consumer — worth grepping for direct predicate use before landing).
- **The `.strict()` zod schema on `MediaRuleDescriptorSchema`.** If `options` is added to the interface/registry but the wire schema (`schemas.ts`) or the MSW mock fixture is missed, requests validate away the field silently (zod `.strict()` throws on unknown keys during *parsing* input, but a response the client parses through this schema would simply have `options` stripped if the schema doesn't declare it — need to double check whether the client actually runs descriptors through `MediaRuleDescriptorSchema.parse` anywhere, or just types them via `z.infer`; if it's only type-level (as `useMediaRules.ts` suggests — it just `fetch`+casts, no `.parse()` call), a missed schema field means no runtime error at all, just a TypeScript type without the field showing up on a real network response, which is exactly the "no crash, wrong behavior" case the brief warns about. **This needs verification**: check whether any client code actually calls `MediaRuleDescriptorSchema.parse(...)` on the `/api/media-rules` response (not confirmed — `useMediaRules.ts` appeared to skip runtime validation and just cast).
- **`filterSummary.ts` and `QueryRow`** rendering the raw CSV string unformatted is not a crash but is the visible "still looks like the old bad UX" failure mode if this file is missed — a reviewer eyeballing "does multi-select look right" would only catch it by checking the saved-query list view, not just the filter bar.
- **Options list drift**: if `seriesType`'s three literal values (`server/domain/show.ts`) ever change (e.g. upstream provider adds a new series type) without the registry's hardcoded `options` list being updated, the predicate would still evaluate correctly against the real field but the picker would silently never offer the new value as choosable — a "can't be reached from the UI" gap with no error anywhere.

---

## Exploration log (in order, as self-reported by the worker)

1. List repo root + read root instructions file — oriented on repo layout and docs conventions (in_progress/intent/architecture).
2. List docs/architecture, docs/intent, docs/in_progress — found the exact program (media query engine + client alignment) governing this area.
3. Read: docs/architecture/media-query-engine.md — confirmed the server-side query/predicate model and single-authority registry.
4. Read: docs/intent/filter-ui.md — found it's superseded by Phase 4, pointed at `filterRegistry.ts` and `MediaFilterBar`.
5. Read: server/utils/filterRegistry.ts — the actual rule registry: dataTypes, predicates, all 26 rules including `genres`/`network`/`seriesType`.
6. Read: docs/in_progress/README.md — the phased program overview; confirmed Phase 4 is the live, relevant plan.
7. Read: docs/in_progress/AGENT_BRIEF.md — shared TDD/gates conventions for this program.
8. Read: docs/in_progress/phase-4-client-query-alignment.md — the full Stage 1/2 design, including the settled "generic dataType codec" decision and the "renamed key vocabulary" fracture history.
9. Read: docs/in_progress/phase-4-stage-2-tdd-handoff.md — current exact implementation state (what's shipped vs. Cycle 5 pending, including the explicit note that lookup-backed multiselects for csv-ids/csv-strings are still open work).
10. Find: located src/components/filters, src/hooks, server/modules/mediaRules directly via filename search.
11. Read: src/components/filters/RuleControl/index.tsx — the dataType→widget rendering switch (where a new branch goes).
12. Read: src/hooks/useMediaFilters.ts — the client URL encode/decode codec (confirmed default branch handles strings generically, no change needed).
13. Read: src/components/filters/OptionFilter/index.tsx — confirmed it's single-value-only, so multi-select needs a new component, not reuse.
14. Grep: coerceRuleValue/parseFilterValues/browseQuerySchema in server/modules/media/media.handler.ts — confirmed server browse codec's default branch also handles strings generically.
15. Read: server/modules/mediaRules/mediaRules.handler.ts + .routes.ts — the descriptor endpoint (`GET /api/media-rules`), confirmed it projects straight from `MEDIA_RULES`.
16. Grep: MediaRuleDescriptorSchema/FilterValueSchema in src/lib/api/schemas.ts — located the wire schema file.
17. Read: src/lib/api/schemas.ts (lines 1-70) — the exact zod schemas including `.strict()` on `MediaRuleDescriptorSchema`.
18. Read: src/hooks/useMediaRules.ts — confirmed the client hook types via `z.infer` and does not appear to call `.parse()` on responses (flagged as a risk to verify).
19. Read: src/hooks/useMediaLookups.ts + src/hooks/useMediaQueries.ts — confirmed genres/network are dynamic-lookup driven (not "fixed" in the requested sense), and how saved-query persistence maps values.
20. Grep: seriesType/seriesStatus/tmdbStatus in server/domain, server/providers — found `seriesType` is a true closed 3-value enum in the domain type (`server/domain/show.ts:13`).
21. Grep: status in server/providers/sonarrProvider.ts + broader grep for seriesType/seriesStatus across tests/src/server — found all existing test coverage referencing `seriesType`, confirming what would need updating and that its current tests only ever assert single-value predicate behavior.
22. Read: server/__tests__/utils/filterRegistry.test.ts (relevant section) + server/__tests__/integration/media.handler.pinning.integration.test.ts (relevant sections) — confirmed exact existing test assertions for `seriesType`/`genres`/`network`, verifying the CSV-predicate change is behaviour-preserving for these.
23. Find + Read: src/components/MediaFilterBar/index.tsx — confirmed the bar is fully data-driven off `RuleControl`/descriptors (post Stage-2), no separate prop-per-field code path to also update.
24. Grep: dataType/getRule in server/services/mediaQueryService.ts — located the persistence-layer coercion.
25. Read: server/services/mediaQueryService.ts — confirmed persistence's `coerceValue`/`serializeValue` default branches handle strings generically (no change needed there either).
26. Grep: dataType across src, server, tests — swept for every file referencing `dataType` to check for missed exhaustive-switch sites.
27. Read: src/components/filters/RuleControl/__tests__/RuleControl.test.tsx + tests/mocks/handlers/mediaRules.ts + partial read of server/__tests__/integration/mediaRules.integration.test.ts — confirmed exact existing unit/mock coverage to extend.
28. Grep: dataType across MediaFilterBar.stories.tsx/.test.tsx, Media.stories.tsx, useMediaFilters.test.tsx — confirmed these are all additive fixture lists, not exhaustive switches, so adding a new dataType is safe there.

**Total tool calls (self-reported): 28.**

**Self-reported confidence every file needing change was found: High.** The codebase's own documentation independently confirms the architecture is a single generic `dataType`-keyed codec on both client and server (not a per-rule-type scatter), and traced that codec through every layer it touches — registry/predicate, wire schema, browse URL codec, persistence coercion, and the one rendering switch — plus swept every remaining file mentioning `dataType` to rule out a missed exhaustive-switch site. The one residual uncertainty is whether client-side runtime validation (`.parse()`) is actually exercised anywhere against `MediaRuleDescriptorSchema`, flagged explicitly as needing verification rather than asserted confidently either way.

## Raw metrics (measured, not self-reported)
- Tool uses (harness-counted): 33
- Wall-clock duration: ~259s
- Tokens consumed: ~81,500
