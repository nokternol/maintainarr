---
target: routing and sidebar consistency
total_score: 19
p0_count: 2
p1_count: 2
timestamp: 2026-06-02T20-13-31Z
slug: routing-and-sidebar-consistency
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Active sidebar states exist but unreliable — item sets differ per page, so "active" loses meaning |
| 2 | Match System / Real World | 3 | Terminology is clear and domain-appropriate throughout |
| 3 | User Control and Freedom | 2 | Users get stranded on several pages — Media has no path to Automations, Activity, or System; Settings has no path to Media |
| 4 | Consistency and Standards | 1 | Every page defines its own sidebar nav independently; same app, five different navigation schemas |
| 5 | Error Prevention | 1 | `/index.tsx` contains a hard-coded redirect to `/media`, bypassing auth entirely |
| 6 | Recognition Rather Than Recall | 2 | Items visible on Dashboard disappear on Media and Settings |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no bulk actions; basic tabbing works |
| 8 | Aesthetic and Minimalist Design | 2 | Login page has three banned patterns: all-caps heading, glassmorphism card, uppercase eyebrow kicker |
| 9 | Error Recovery | 3 | Auth failure messages are clear, specific, and well-positioned |
| 10 | Help and Documentation | 1 | No help system anywhere |
| **Total** | | **19/40** | **Acceptable (borderline Poor)** |

## Anti-Patterns Verdict

**LLM assessment:** Login page trips three absolute bans: all-caps h1 "WARDEN", glassmorphism card, "AUTHORIZED ACCESS ONLY" eyebrow. Authenticated pages are much cleaner — different design sessions. Jarring mismatch on first impression.

**Deterministic scan:** `overused-font` (Inter) — false positive; Inter is explicitly specified. `single-font` — genuine: JetBrains Mono is in DESIGN.md but never loaded in `_document.tsx`.

## Priority Issues

**[P0] Root route bypasses authentication**
`src/pages/index.tsx:5-7` — DEV BYPASS left in: redirects to `/media` unconditionally. Unauthenticated users skip login.
Fix: Change redirect destination to `/login`.

**[P0] Sidebar navigation schema is different on every page**
Five pages, five independent `sidebarItems` arrays. Dashboard: 7 items. Media: 3 (no Automations, Activity, System, Logout). Settings: 3 (no Media). Search: 3 (no Media). Ratings: 3 (no Media or Settings).
Fix: Single shared `src/lib/navigation.ts` export; `active` determined by `useRouter().pathname`.

**[P1] Login page has three banned design patterns**
(a) `uppercase` on h1 "WARDEN" — banned. (b) `backdrop-blur-xl` glassmorphism card — banned as default. (c) "AUTHORIZED ACCESS ONLY" eyebrow — banned.
Fix: Title-case heading, solid card background, remove/demote eyebrow.

**[P1] Logo on authenticated pages is a placeholder "W" box**
Dashboard/Media/Search/Settings/Ratings all use a `<div>W</div>` box; login uses the real `<WardenLogo />`.
Fix: Use `<WardenLogo />` in shared sidebar logo slot.

**[P2] JetBrains Mono specified but never loaded**
DESIGN.md specifies JetBrains Mono; `_document.tsx` only loads Inter. `font-mono` falls back to system mono.
Fix: Add JetBrains Mono to Google Fonts link in `_document.tsx`.

## Persona Red Flags

**Morgan (Self-Hosted Operator):** Arrived at `/`, bypassed login, hit media page unauthenticated. Tried to navigate to Automations from Media sidebar — not there. Went back to Dashboard, then Settings — sidebar changed completely, Media disappeared. 40 seconds lost to nav confusion. High frustration.

**Alex (Power User):** "W" box in sidebar raised a flag — build artifact or intentional? No keyboard shortcuts. Multi-tab navigation exposes the inconsistency immediately.

**Sam (Accessibility-Dependent User):** Screen-reader landmark nav breaks — sidebar `<nav>` content changes structure between pages, destroying the learned model.

## Minor Observations

- Login uses `rounded-3xl`/`rounded-2xl` — outside the design system (max is `--radius-md: 8px`).
- Dashboard table header column labels use `uppercase tracking-wide` — eyebrow pattern in a table context.
- Media page breadcrumb `{ label: 'Home', href: '/' }` will route to `/media` until the dev bypass is removed; should point to `/dashboard`.
