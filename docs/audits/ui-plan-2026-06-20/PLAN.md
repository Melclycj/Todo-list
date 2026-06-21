# UI/UX Improvement Plan — Todo List App

**Date:** 2026-06-20 · **Mode:** advisory (sprint-first toolbox) · **Deliverable:** plan only, no code changed
**Evidence:** 6 cross-validated read-only audits in this folder + 1 adversarial review pass.
**Synthesizer:** uiux-product-orchestrator (E5 existing-app upgrade, max tier)

> Feeds `docs/requirements.md` + `docs/sprints.md`. Does **not** lock a chassis or create `.uiux/` / `.planning/` scaffold. Every requirement below is a **draft** awaiting your confirmation per the sprint "New Feature Request" gate.

---

## 0. Conflict resolutions (cross-check + adversarial review corrected these)

1. **Contrast "BLOCKERs" were WRONG — do NOT darken `--primary`.** The a11y agent mis-derived hex values. Recomputed (WCAG 2.1):
   - `--primary 221 83% 53%` = **#2463EB** → **5.17:1 on white = PASS** (agent claimed #3B7FED / 4.17 FAIL).
   - `--muted-foreground 220 2% 45%` = **#707275** → **~4.9:1 on white = PASS**; only **~4.2:1 when placed on `bg-muted`** = a narrow WARNING.
   - Net: there is **no** primary-contrast blocker; the only real item is muted-foreground used *over muted backgrounds*.
2. **`App.css` is inert dead code** — grep confirms it's never imported (`main.tsx` loads only `index.css`). Delete for hygiene; **zero** visual impact (the a11y agent's "311px squeeze" was false).
3. **`animate-pulse` reduced-motion is fine** — the global `*{animation-duration:0.01ms!important}` rule covers it. Not a gap.
4. **Dead components:** `TaskStatusCircle.tsx`, `TaskRowExpanded.tsx` defined but never imported. Delete.

---

## 1. The picture

Functionally rich (subtasks, drag-reorder, recurring, archive, confirms on big deletes, 7 tailored empty states, skeletons) with four gap classes:

- **A. Correctness / shipped-but-broken** — SSE reminders don't actually work (silent polling fallback); a view option that does nothing; no undo.
- **B. Accessibility** — icon-only buttons with no accessible name (flagged by 4 agents), no keyboard drag, no focus trap, `<div>`-as-button. (Contrast is NOT a problem — see §0.)
- **C. Design maturity** — status colours not wired to their own tokens, generic chassis, auth screen is a template, list density too loose.
- **D. Resilience** — no React error boundary (any render throw = white screen), auth blank-flash.

---

## 2. Recommended visual direction (your pick drives FR-18)

| | Direction | Effort | Why |
|---|---|---|---|
| ★ | **A — "Slate Studio"** | **Low** | Sharpens the existing blue/Inter chassis: cool-leaned grays, 13–14px row type, refined accent, 4–6px radius, real sidebar depth step. Best precision per effort, lowest regression. **Recommended** (adversarial review concurred). |
| | B — "Warm Ink" | Medium | Warm off-white + amber accent + optional serif titles. Most personality; replaces the gray family. |
| | C — "Graphite Night" | High | Premium dark-first. Requires building a dark theme (none exists). Best as a **future** requirement after the light theme lands. |

---

## 3. Proposed requirements (prioritized, draft SMART criteria)

> Provisional IDs continue from FR-14 / NFR-08.

### P0 — Correctness & trust

**FR-15 · Fix broken SSE reminder authentication** ⚠️ *backend/auth — routes to AppSec, not a visual fix*
*Why:* `reminder.ts` sends JWT as `?token=` but backend `HTTPBearer()` (`dependencies.py`) reads only the `Authorization` header → stream 401s → `useReminder` retries 3× then silently polls every 60s. The "real-time reminders" feature is effectively non-functional; a unit test asserts the broken URL (false green). Query-param tokens also leak into server/proxy logs (ASVS V7/V9).
*SMART:* an authenticated user's EventSource stream connects without 401 and receives a pushed reminder in an integration test; the access token is no longer carried in a URL query string (use a short-lived stream ticket, cookie, or header-compatible transport); the test asserting the old `?token=` URL is corrected to the new contract. *Route:* AppSec review required (auth + token-in-URL).

**FR-16 · Remove the non-functional "Task Board" view**
*Why:* the dropdown offers "Task Board", persists it, renders nothing (`TaskListPage.tsx:40,67`; `TaskList` always rendered :125).
*SMART:* the view-mode control offers only options that change the rendered output; the unused `viewMode` state, the `board` option, and the now-unused `ViewMode` type are removed (or the board view is implemented). *Test:* component test asserting each option yields a distinct render; no persisted value produces a no-op. *(A real board view, if wanted, is a separate future FR.)*

**FR-17 · Undo + recovery for reversible actions**
*Why:* zero `action:` props on any toast — delete/status/reorder/subtask-delete are all irreversible, and users aren't told deletes go to Archive (`ux-laws#2,#3`).
*SMART:* delete-task, delete-topic, status-change, drag-reorder, and subtask-delete each show an Undo toast that restores the **single immediately-preceding state** of that entity (asserted by E2E per action); delete toasts state the item is in Archive; subtask-delete gains a **confirm dialog** (matching task-delete) — pick confirm OR undo and assert that exact affordance exists.

**NFR-09 · Accessibility baseline (keyboard, names, focus)** — *contrast removed; see §0*
*Why:* icon-only buttons with only `title=` (4 agents), no keyboard drag, custom drawer has no focus trap, `<div>`-as-button in Archive/TopicSelector (`design-core#3`, `secondary#4,10`, `a11y#6,7,8,10,11`).
*SMART:* (a) every icon-only button has an `aria-label`; (b) drag-reorder operable via keyboard (dnd-kit `KeyboardSensor`); (c) the create-drawer has `role="dialog"`+`aria-modal`+focus-trap+Esc; (d) archive-expand and all custom interactive elements are keyboard-focusable/operable with visible focus indicators; (e) status not conveyed by colour alone; (f) **axe-core reports 0 serious/critical violations** at 320/768/1440, and any token measured `<4.5:1` on its actual background (i.e. muted-fg on muted-bg) is darkened. *Test:* axe per surface + keyboard-path E2E.

### P1 — Token architecture + premium lift

**NFR-10 · Design-token integrity**
*Why:* status badges hardcode raw `gray/amber/emerald` palette and ignore the declared `--status-*` tokens (2 agents); 3 different `bg-black/*` scrims; magic `zIndex:9999`; dead files (`design-core#1,2`, `consistency#4–15,44–46`, `secondary#3`).
*SMART:* status badges render via `--status-*` tokens (no raw status palette classes remain — grep-asserted); one `--overlay` token replaces all `bg-black/*` at a single opacity; no inline z-index literals; dead files removed (`App.css`, `TaskStatusCircle.tsx`, `TaskRowExpanded.tsx`); off-scale micro-type normalized. *Test:* grep asserts zero raw status palette + zero `bg-black/` + zero inline `zIndex`; build green after deletions.

**FR-18 · Apply a locked premium visual direction** *(blocked on your A/B/C pick)*
*Why:* generic chassis — 15px/1.5-lh too loose for dense rows, <2% gray saturation (no hue identity), 100%-sat accent reads cheap, invisible sidebar step, 8px radius chunky (`grounding §4`).
*SMART (chosen direction):* tokens updated to the locked palette; `--accent` saturation reduced to a fixed target value; `--radius` set to 4–6px; list-row body 13–14px with line-height ≤1.4; sidebar ≥3% luminance step from canvas; all `transition-duration` values resolve to ≤N named tokens (grep-countable). *Test:* token snapshot + visual-regression baselines at 320/768/1440.

**FR-19 · Auth first-impression redesign**
*Why:* auth is the anti-template — flat centered gray card, generic "Todo" wordmark, reversed heading hierarchy; first thing users see (`secondary#1,2,7`).
*SMART:* auth moves off the centered-gray-card template (branded split panel or brand element); a real wordmark replaces plain "Todo"; the card's action heading is the dominant element (e.g. `text-2xl` vs brand demoted to logotype); axe-clean. *Test:* visual regression + brand-element presence + heading-order check.

### P1/P2 — Responsive (enriches EXISTING backlog NFR-05)

**NFR-05 · Responsive layout for tablet + mobile** *(already in backlog — now evidenced)*
*Why:* task table forces ~875px fixed width @375px (no card fallback); tablet 768–1023 has no sidebar; touch targets <44px; restore/row actions hover-only (`a11y#3,4,5,10`, `secondary#11`, `ux-laws#12,15`).
*SMART:* task list usable at 320/375/768 with no horizontal overflow (card/stacked view below `md:`, or sticky status+title columns); tablet 768–1023 has navigation; all interactive targets ≥44px on touch; restore + row actions reachable without hover. *Test:* Playwright screenshots at 320/375/768/1024/1440 with no overflow + touch-target assertions.

### P2 — States, resilience & polish

**NFR-11 · Error states, error boundary & visual polish**
*Why:* `useTasks`/`useTopics` network error renders nothing; **no React error boundary anywhere** (Sentry init'd but unused → any render throw = white screen); `RequireAuth` returns `null` during refresh (blank flash); auth collapses all failures to one string; New-Task not visually dominant; header has no action/filter separation (`design-core#6,7,13,14`, `secondary#8,14`, `ux-laws#8`, adversarial review).
*SMART:* an app-level error boundary (wire `Sentry.ErrorBoundary`) renders a fallback instead of a white screen; tasks + topics show an error state with retry on fetch failure; `RequireAuth` shows a spinner (not blank) during refresh; auth differentiates network vs credential vs server errors; **New-Task renders `variant=default` (filled) while every other header button is `ghost`/`outline`**; filter/action header clusters are visually separated; secondary-page headers share one pattern. *Test:* error-state E2E (mocked failure + thrown render) + DOM assertions.

---

## 4. Suggested sequencing

1. **Sprint A — correctness + a11y (P0):** FR-15 (SSE, +AppSec), FR-16, FR-17, NFR-09. High-trust, mostly mechanical, low regression. FR-15 is the standout (a shipped feature that doesn't work).
2. **Sprint B — token + look (P1):** NFR-10 → FR-18 (pick direction) + FR-19. NFR-10 must precede FR-18 (wire tokens before re-skinning).
3. **Sprint C — responsive + polish:** NFR-05 (enriched) + NFR-11.
4. **Future:** "Graphite Night" dark mode; full board view — each its own FR.

## 5. Explicitly out of scope (named, not silently dropped)

Form-validation UX patterns, i18n / RTL, print styles, extreme long-content overflow — legitimately out of scope for this product stage. Revisit if the product internationalizes or adds long-form content.

## 6. Boundaries honored

Advisory only — no `.uiux/`, no chassis lock, no competing `.planning/` scaffold. Nothing written to `requirements.md` / `sprints.md` yet. **FR-15 (SSE auth) and the query-param-token finding cross into backend/auth → must route through AppSec** per the project's own security rule when scheduled.
