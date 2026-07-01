# Plan A

(Method A worker — context-gathering method withheld for blind grading)

## Implementation Plan: `multi-select` filter rule dataType

### Chosen proof-of-concept rule

Convert `genres` (the movie-content-type entry in `MEDIA_RULES`) from `dataType: 'csv-strings'` to `dataType: 'multi-select'`, with a fixed option list (the standard TMDB movie genre names — a genuinely bounded, well-known vocabulary, unlike `network` or `certification` which are open-ended, provider-supplied strings). This best matches the brief's "fixed set of values ... user has to know the exact spelling" complaint. Note there are *two* separate `genres` entries in `MEDIA_RULES` (one `contentTypes: ['movie']`, one `contentTypes: ['show']`, same `key`) — only convert the movie one for the POC; leave the show one as `csv-strings` (mention this explicitly since it's an easy thing to miss/forget and would silently leave the show tab's "Genres" control unconverted while looking like a single shared rule).

### Architecture context that matters

This app just finished ("Phase 4 Stage 2") building exactly the data-driven mechanism this feature needs: one `MediaRuleDescriptor.dataType` union drives (a) the client widget in `RuleControl`, (b) the client URL codec in `useMediaFilters`, (c) the server browse codec in `media.handler.ts`, and (d) the server persistence codec in `mediaQueryService.ts`. Adding `multi-select` is "add one more case to four parallel switch statements plus a new descriptor field," not a new subsystem. The in-progress doc `docs/in_progress/phase-4-stage-2-tdd-handoff.md` (Cycle 5) already anticipates this exact need: *"Lookup-backed multiselect dropdowns for csv-ids/csv-strings rules ... descriptors carry no enum metadata — keep a small client option-set map keyed by rule key, or extend the descriptor."* This plan extends the descriptor (server-owned, travels over the wire) rather than a client-side map, since the brief requires the option list be "declared once per rule" — a client-only map would be a second, driftable source of truth.

Key simplifying fact: the wire encoding for `multi-select` can be **identical** to `csv-strings` — a comma-joined string, both in the URL (`useMediaFilters`/`media.handler.ts` default case) and in DB persistence (`mediaQueryService` `coerceValue`/`serializeValue` default case). So `multi-select` needs *no new codec branch* anywhere except the type union additions (TypeScript requires the literal to exist, but the `default:`/fallthrough behavior already does the right thing) — the actual new work is (1) the `options` field on the descriptor, (2) the predicate (identical to genres' existing `csv-strings` predicate — reuse `parseCsvStrings`), and (3) the new picker widget in `RuleControl`.

### Files to touch, in order

**1. `server/utils/filterRegistry.ts`**
   - Add `'multi-select'` to `MediaRuleDescriptor.dataType` union (and thus `MediaRule`).
   - Add `options?: string[]` to `MediaRuleDescriptor` (fixed value list; optional so every other rule is unaffected).
   - Change the movie `genres` entry's `dataType` to `'multi-select'` and add `options: [...]` (the canonical genre list). Keep its `predicate` as-is (already does `parseCsvStrings(value).some(...)` against `item.genres`) — multi-select values decode to the same comma-joined string, so no predicate change needed.
   - Verify: confirm nothing elsewhere assumes `dataType` is one of a closed 6-member set exhaustively (e.g. a `switch` with no default that would now silently mis-handle it) — checked `RuleControl`, `useMediaFilters`, `media.handler.ts`, `mediaQueryService.ts` below; all use `if`/`switch` with a fallback branch, so an unhandled case degrades to "string" behavior rather than crashing. That's a "silently wrong, not broken" risk to watch, not a blocker — but it's worth double-checking with `grep -n "dataType ===" ` across the repo once more right before finishing, in case there's a spot not yet found that does something like `dataType === 'csv-strings' || dataType === 'csv-ids'` and now needs `multi-select` added to that OR-list.

**2. `src/lib/api/schemas.ts`**
   - Add `'multi-select'` to the `MediaRuleDescriptorSchema.dataType` z.enum.
   - Add `options: z.array(z.string()).optional()` to `MediaRuleDescriptorSchema` (must stay `.strict()`-compatible — add the field, don't just widen).
   - This is the client-side mirror of the server descriptor; if it's missed, the SWR fetch of `/api/media-rules` will 200 but Zod validation (if this schema is used to *parse* the response, not just type it) will strip/reject `options`. **Verify**: check whether `MediaRuleDescriptorSchema` is actually run through `.parse()`/`.safeParse()` anywhere on the client response, or only used for `z.infer` typing — if the former, forgetting `options` here silently drops the option list at runtime (no type error, since the *type* still matches minus the field) — this is exactly the "no crash, just wrong" failure mode the brief warns about.

**3. `src/hooks/useMediaRules.ts`**
   - No code change expected (it derives its type from the schema), but re-read after step 2 to confirm `MediaRuleDescriptor` (the client type) now carries `options`.

**4. `src/components/filters/RuleControl/index.tsx`**
   - Add a new branch: `if (rule.dataType === 'multi-select')`. Render a multi-select/checkbox-tag picker using `rule.options ?? []`.
   - Value handling: `value` is `FilterValue | undefined`, currently a `string` (comma-joined) for `csv-strings`/multi-select. Need helpers analogous to `parseCsvStrings`/`asRange` — e.g. `asStringArray(value): string[]` (split on comma, trim, filter empty) and a reverse `toCsv(string[]): string | undefined` (join with comma, `undefined` when empty) so `onChange(rule.key, undefined)` fires when the last option is deselected (mirrors how `range`'s `emptyToUndefined` and boolean's `undefined` clear behavior work elsewhere in this file — consistency matters because `useMediaFilters`'s `onRuleChange` treats `undefined` as "delete this key from the draft," and `browseParams`/URL-sync depend on that to omit the param entirely rather than round-tripping as `key=`).
   - **New sub-component needed**: there is no existing multi-value checkbox/tag-picker component in the repo (`OptionFilter` is single-value `T | undefined`, not `T[]`). Build a new component, e.g. `src/components/filters/MultiSelectFilter/index.tsx`, following `OptionFilter`'s conventions (chips-style toggle buttons, `aria-pressed`, `label`/`options`/`value`/`onChange` prop shape) but with `value: T[]` and toggle-add/remove semantics instead of single-select. Do **not** try to shoehorn this into `OptionFilter` itself — its API and rendering logic (single active highlight, single clear-×) is fundamentally single-value; forcing multi-value through it either breaks `OptionFilter`'s existing callers or produces an awkward union prop API. A sibling component is cleaner and matches how `RuleControl` already composes small purpose-built pickers.
   - Build the `MultiSelectFilter` component with a story-first workflow, verify visually, *then* wire it into `RuleControl`.

**5. `src/hooks/useMediaFilters.ts`**
   - No change required to `encodeValue`/`decodeValue` (multi-select falls into the `default:` string-passthrough branch already used by `csv-strings`/`csv-ids`/`string`). Confirm this by tracing: a multi-select value coming out of the new widget must be a `string` (not `string[]`) by the time it reaches `onChange`, i.e. the widget itself must join to CSV before calling `onChange(rule.key, csv)` — this is a **contract the new widget must uphold**, not something the hook enforces; if the widget instead calls `onChange(rule.key, ['Action','Drama'])` (an array), `encodeValue`'s `typeof value === 'object'` branch would misfire (it currently assumes "object" means `RangeValue` and would try `value.min`/`value.max`, silently producing `"undefined..undefined"` in the URL — a serious silent-corruption risk). **This is the single highest-risk spot in the whole change** — worth a dedicated unit test asserting the URL round-trip for a multi-select value, not just a `RuleControl` unit test in isolation.

**6. `server/modules/media/media.handler.ts`**
   - No change required to `coerceRuleValue` (multi-select falls into `default: return raw` — same as csv-strings today). Just confirm via a browse-endpoint integration test that `?genres=Action,Drama` matches correctly end to end (this is really exercising the existing csv-strings path plus the new registry entry, but it's cheap insurance).

**7. `server/services/mediaQueryService.ts`**
   - No change required to `coerceValue`/`serializeValue` (multi-select falls into the string default on both). Confirm a saved query with a multi-select value round-trips through `create()` → `list()`/`getById()` unchanged.

**8. Tests to add/update**
   - `server/__tests__/utils/filterRegistry.test.ts`: add a `dataType classification` case for `getRule('genres','movie')!.dataType === 'multi-select'`, and confirm the `predicate` still passes/fails correctly (existing genres predicate tests likely need to move or duplicate since movie/show genres now diverge in dataType even though the predicate logic is shared).
   - `src/components/filters/RuleControl/__tests__/RuleControl.test.tsx`: new test(s) for the `multi-select` branch — rendering the picker from `rule.options`, toggling an option emits the right CSV string, toggling the last one off emits `undefined`.
   - `src/hooks/__tests__/useMediaFilters.test.tsx`: add a case proving a multi-select value round-trips through the URL codec (encode a two-item selection, decode it back).
   - `tests/mocks/handlers/mediaRules.ts`: add a `multi-select` entry to `MOCK_MEDIA_RULE_DESCRIPTORS` (the comment there literally says "One per `dataType` so data-driven rendering is exercised across every widget kind" — this file needs a new fixture entry or it stops being true) with a small fixed `options` array.
   - `server/__tests__/integration/mediaRules.integration.test.ts`: check whether it snapshots the full descriptor shape (asserting the exact keys) — if so, adding `options` to one entry may need a corresponding assertion update. **Verify this file's content before starting** — not yet read; it's the most likely place for a silent test-drift or false failure.
   - `src/components/MediaFilterBar/__tests__/MediaFilterBar.test.tsx` and `.stories.tsx`: likely fine unmodified since `MediaFilterBar` is purely descriptor-driven and doesn't branch on dataType itself, but worth a quick look since it hardcodes a small descriptor list for its own tests (may want a multi-select rule added there too for coverage of the "renders per descriptor" contract).

**9. `src/lib/utils/filterSummary.ts`**
   - No change strictly required — the `LABELS` map already has a `genres: 'Genres'` entry and the generic `${label}: ${value}` fallback will render the comma-joined string fine for the saved-query chip summary. Flag as "acceptable as-is for the POC," not a gap.

**10. Docs**
   - `docs/in_progress/phase-4-stage-2-tdd-handoff.md` Cycle 5 explicitly names this work ("Lookup-backed multiselect dropdowns... extend the descriptor") — once this ships, that bullet should be checked off/annotated per docs convention (update in_progress status, don't leave it describing already-shipped work as pending).

### Things not fully sure about / would verify before writing code

1. **Whether `MediaRuleDescriptorSchema` is actually `.parse()`d on the client fetch path**, or purely used for typing (see item 2 above) — determines whether missing `options` in the zod schema is a hard failure or a silent data-loss bug.
2. **`server/__tests__/integration/mediaRules.integration.test.ts`** contents — unread; may assert exact descriptor shape/count and could need updates not yet scoped.
3. **Exact TMDB genre list to hardcode** — a product/content decision, not architectural; would confirm with whoever owns the genre taxonomy rather than guess (movie vs. TV genre lists differ; picking the movie-only rule sidesteps needing the TV list too, but it's still a real list to get right, not an "up to me" detail).
4. **CSS/visual design of the new multi-select widget** — no existing multi-select component to copy pixel-for-pixel; `OptionFilter`'s `chips` variant is the nearest visual precedent but is single-select, so the new component's "selected" state UI (checkmarks vs. highlight vs. count badge) needs a quick design pass before final polish.
5. **Whether any consumer treats `dataType` values as an exhaustive closed union** (TS `never` check) — a compile error would actually be the *safe* outcome here (loud), so this is lower risk, but running `yarn typecheck:client && yarn typecheck:server` immediately after adding the union member would catch any exhaustiveness-switch site not yet found via grep.

### What could silently break

- **The `typeof value === 'object'` branch collision in `encodeValue`/`decodeValue`** (`useMediaFilters.ts`) if the new widget ever emits an array or object instead of a joined string — described in detail under file 5 above. This is the top risk.
- **Forgetting the show-content-type `genres` entry is a separate object** and assuming "genres" is one rule — converting only the movie entry (intentional for the POC) but not documenting it could make a future engineer "fix" the show tab by copy-pasting `dataType` without copying `options`, or vice versa think both were supposed to change and file a bug.
- **`options` silently absent at runtime** due to the zod-schema gap in item 2/1 above — the UI would fall back to rendering an empty picker with no crash, no type error, just a filter control with nothing in it.
- **CSV round-trip edge cases**: genre names containing a literal comma (unlikely for TMDB's fixed list, but if `options` ever includes a value with a comma, the CSV codec silently mis-splits it — worth a defensive note even if not fixed now, since it's the same latent bug the existing `csv-strings` type already has).
- **Saved-query health/gating (`computeHealth` in `mediaQueryService.ts`)** keys off `sourceProviders`, not `dataType` — should be unaffected, but worth a quick sanity check that a multi-select rule's health computation doesn't accidentally special-case dataType anywhere (it doesn't, per the code read, but flagging since it's adjacent).

---

## Exploration log (in order, as self-reported by the worker)

1. Read repo root instructions file — repo conventions (docs folders, UI-change process).
2. List docs/architecture, docs/intent, docs/in_progress — surfaced `filter-ui.md` and `phase-4-client-query-alignment.md` as directly relevant.
3. Graph-tool query: "filter rule types" — pointed at `RuleControl`, `useMediaRules`, `MediaRuleDescriptor`.
4. Read: docs/intent/filter-ui.md — turned out stale/superseded (absorbed into Phase 4), but named the right files.
5. Read: src/hooks/useMediaRules.ts — SWR hook over `/api/media-rules`, descriptor-only client type.
6. Graph-tool "explain": "MediaRuleDescriptor" — confirmed only 3 direct connections (index.tsx, useMediaRules.ts, test) — graph didn't have deep detail here.
7. Graph-tool "explain": "filterRegistry" — matched the test file, not the source; graph's node resolution was imprecise for this query.
8. Read (parallel): server/utils/filterRegistry.ts, src/components/filters/RuleControl/index.tsx, src/lib/api/schemas.ts — the core registry, the dataType-switch widget, and the zod schema; found `dataType` union, `options` gap, existing genres/network rules.
9. Graph-tool query: "how are filter values encoded and decoded in the URL" — returned noise (DB migration `url` columns), not useful; confirms tool matched on token "url" literally rather than concept.
10. Find: located OptionFilter / useMediaFilters / useMediaQueries directly via filename search.
11. Read: src/hooks/useMediaFilters.ts — the client URL codec (`encodeValue`/`decodeValue`), confirmed csv-strings/multi-select would share the string-passthrough default branch.
12. Find (parallel with above read): confirmed only 3 files under OptionFilter, no pre-existing multi-select variant.
13. Read: src/components/filters/OptionFilter/index.tsx — confirmed it's single-value (`T | undefined`), not directly reusable for multi-select.
14. Grep: "dataType" across repo — found every file referencing `dataType` (7 files), the master list driving the rest of the plan.
15. Read (parallel): server/modules/media/media.handler.ts and server/services/mediaQueryService.ts — the two server-side dataType-switch codecs (browse decode, DB persist/load).
16. Grep: "multi-select|MultiSelect|checkbox" in src — confirmed zero existing multi-select-flavored components anywhere in the client.
17. Read (parallel with above grep): tests/mocks/handlers/mediaRules.ts — MSW fixture with "one descriptor per dataType" convention, needs a new entry.
18. Read (parallel): docs/in_progress/phase-4-client-query-alignment.md and README.md — surfaced the active Phase 4 program and its phasing.
19. Read (parallel with above): src/components/filters/RuleControl/__tests__/RuleControl.test.tsx — test pattern/conventions to mirror for the new dataType.
20. Git log (parallel, two calls) — confirmed the in_progress doc's "NOT STARTED" framing was stale relative to actual commit history.
21. wc -l / sed on docs/in_progress/*.md — found the actually-current status doc, which explicitly names "multiselect dropdowns for csv-ids/csv-strings" as Cycle 5's planned next work — directly validates this plan's approach.
22. Read: docs/in_progress/phase-4-stage-2-tdd-handoff.md (remaining lines) — read Cycle 5 in full, the strongest single piece of evidence for how to shape this feature.
23. Grep (parallel, two calls): filterSummary/dataType usage in useMediaQueries.ts and QueryRow — located the saved-query chip-summary util.
24. Read (parallel): src/lib/utils/filterSummary.ts and sed on src/hooks/useMediaQueries.ts — confirmed generic label:value fallback needs no change; confirmed saved-query save path passes the draft straight through (no translation to worry about).
25. Grep: "loadQuery|applyQuery|query\." in src/pages/media/index.tsx — confirmed no "load saved query back into filter bar" feature exists client-side (narrowed "reloaded" scope to server-side persistence + URL deep-link only).
26. Read: src/components/MediaFilterBar/index.tsx — confirmed it's purely descriptor-driven, no dataType branching of its own.
27. Grep: genres/dataType/options in server/__tests__/utils/filterRegistry.test.ts — confirmed existing test structure/naming convention for dataType-classification tests.
28. Grep: MediaFilterBar.test/dataType in src/components/MediaFilterBar/__tests__/MediaFilterBar.test.tsx — confirmed its test fixture is a small hardcoded descriptor list, not tied to mediaRules.ts mock.

**Total exploration tool calls (self-reported): 28** (counting each parallel batch's constituent calls individually).

**Self-reported confidence every file needing change was found: Medium-High.** Traced `dataType` usage exhaustively via grep across the whole repo, which is the strongest signal — it surfaced all 7 non-test files and gave the test-file list too. Two gaps flagged explicitly (`server/__tests__/integration/mediaRules.integration.test.ts` unread, and whether `MediaRuleDescriptorSchema` is actually `.parse()`d at runtime vs. just used for typing) are the two places true confidence would require one or two more reads. Did not find any client-side "load saved query into the filter bar" feature (verified by grep, not just absence-of-evidence) — narrows the "reloaded" requirement in the brief.

## Raw metrics (measured, not self-reported)
- Tool uses (harness-counted): 33
- Wall-clock duration: ~249s
- Tokens consumed: ~72,400
