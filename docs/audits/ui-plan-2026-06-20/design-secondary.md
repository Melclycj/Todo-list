# Secondary-Surface Design Audit

**Audited:** 2026-06-21 | **Baseline:** `frontend/src/index.css` token chassis (shadcn/ui + Tailwind v4)
**Surfaces:** auth (LoginPage, RegisterPage, AuthLayout, RequireAuth), topics (TopicListPage), archive (ArchivePage), recurring (RecurringPage)
**Screenshots:** not captured (code-only audit — no dev server started)
**axe:** static grep only

---

## Findings Table

| # | Severity | Surface | File:line | Pillar | Issue | Concrete fix |
|---|----------|---------|-----------|--------|-------|--------------|
| 1 | BLOCKER | Auth (all) | AuthLayout.tsx:12 | 1 — Visual Hierarchy | App name is plain `"Todo"` — a generic single-word, zero-brand-differentiation label. The auth page is the first impression; the product logo/wordmark slot is blank. No visual anchor beyond an `h1` on a gray background. | Replace `"Todo"` with a meaningful brand mark or at minimum an SVG icon + styled wordmark. Add a subtle product descriptor that communicates value. |
| 2 | BLOCKER | Auth (all) | AuthLayout.tsx:9 | 1 — Visual Hierarchy / Anti-template | Auth layout is exactly the anti-template pattern: centered card on flat `bg-muted`, no layering, no depth signal, no color accent, no texture. Fails `design-quality.md` "clear hierarchy through scale contrast + depth or layering + color used semantically". | Add one intentional layer: a left-side brand panel (split layout) or a background geometric/brand element. Use `bg-background` + a subtle border-top accent stripe using `var(--primary)` to break the flat gray. |
| 3 | BLOCKER | Recurring | RecurringPage.tsx:127 | 4 — Token-Adherence | `zIndex: 9999` is a raw magic number in an inline style — not routed through any token or Tailwind z-scale utility. Defeats layering governance. | Use Tailwind `z-[9999]` at minimum, or add a `--z-portal: 9999` token to `index.css` and reference it via `calc(var(--z-portal))`. |
| 4 | BLOCKER | Recurring | RecurringPage.tsx:516 | 3 — Accessibility | Edit-mode `Pencil` button (`title="Select to stop"`) and Stop/Done icon buttons (Trash2, Check) have only a `title` attribute — no visible label, no `aria-label`. `title` is not a reliable accessible name for AT users. | Add `aria-label="Select templates to stop"` / `aria-label="Stop selected templates"` / `aria-label="Done editing"` to each icon-only button. |
| 5 | WARNING | Auth | LoginPage.tsx:79, RegisterPage.tsx:84 | 3 — Accessibility | Error paragraph `<p className="text-sm text-destructive">` has no ARIA live-region announcement. Screen-reader users submitting the form will not hear the error automatically. | Wrap or replace with `<p role="alert" aria-live="polite">` so AT announces errors immediately on injection. |
| 6 | WARNING | Auth | AuthLayout.tsx:9 | 2 — Spacing & Rhythm | The outer wrapper uses `p-4` (16 px) as the only horizontal breathing room on mobile. At 375 px the card has 8 px real padding each side inside `max-w-sm`. This is below the 12-16 px minimum comfortable gutter. | Change `p-4` to `px-5 py-6` or `p-5`. |
| 7 | WARNING | Auth | LoginPage.tsx:48–49, RegisterPage.tsx:51–52 | 1 — Visual Hierarchy | `h2` ("Sign in" / "Create account") uses `text-lg font-semibold` while the product name above is `text-2xl font-bold`. The heading hierarchy is reversed: the card's h2 should be the dominant element on the page, not smaller than the auxiliary brand name above it. | Promote the card heading to `text-xl` or `text-2xl font-bold`; reduce the brand h1 to `text-base font-semibold` or restyle it as a logotype, not a heading. |
| 8 | WARNING | Topics | TopicListPage.tsx:16 | 6 — Experience / States | No loading or error state for the `useTopics()` fetch. If topics haven't loaded yet, `topic?.name ?? 'Topic'` silently renders "Topic" as the page title — no skeleton, no error message, no differentiation between "loading" and "topic not found". | Add `isLoading` guard from `useTopics()` and render a `Skeleton` in place of the h1 while loading; add a not-found branch if `topic` is undefined after load completes. |
| 9 | WARNING | Topics | TopicListPage.tsx:23 | 1 — Visual Hierarchy | The New Task `<Button size="sm">` sits inline next to the page `h1` at the same vertical midpoint. The task-creation CTA is visually competing with the page identity. Also note: `text-foreground` is specified on this h1 but omitted on Archive (line 100) and Recurring (line 510) h1s — minor token inconsistency. | Move the CTA to the right side of the header bar (use the existing `justify-between` container already present) and standardize all secondary-page h1s to include `text-foreground`. |
| 10 | WARNING | Archive | ArchivePage.tsx:38–39 | 3 — Accessibility | Expand/collapse row click area is `<div onClick={hasSubtasks ? onToggleExpand : undefined}>` — a plain `<div>` acting as a toggle button. No `role="button"`, no `tabIndex`, no keyboard (`Enter`/`Space`) handler. Keyboard-only users cannot expand archived task subtasks. | Replace with a `<button>` element or add `role="button" tabIndex={0} onKeyDown` to the div. |
| 11 | WARNING | Archive | ArchivePage.tsx:67–76 | 6 — Experience / States | The Restore button uses `opacity-0 group-hover:opacity-100` reveal — it is invisible by default and only shown on hover. On touch devices there is no hover, so Restore is permanently inaccessible. | Show the button at reduced opacity (`opacity-40`) by default and full on hover/focus, or surface it via a context menu that works on tap. |
| 12 | WARNING | Recurring | RecurringPage.tsx:268 | 5 — Cross-Surface Consistency | RecurringPage uses a full `<table>` with `<thead>/<tbody>` and resizable columns, while TopicListPage delegates entirely to `TaskList` (which uses the same table pattern from `TaskTableHeader`). The pattern is consistent at the component level, but RecurringPage reinvents the table header from scratch (`RecurringTableHeader`) rather than reusing `TaskTableHeader` — duplicating column-resize and sticky-header logic. | Extract shared sticky-resizable-header logic to a single `TableHeader` primitive and have both RecurringTableHeader and TaskTableHeader consume it. |
| 13 | WARNING | Recurring | RecurringPage.tsx:103–114 | 1 — Visual Hierarchy | `EditableSelectCell` renders a bare `<span>` that looks like static text; only cursor change signals it is interactive. There is no focus ring, no border affordance, no hover background contrast sufficient to communicate "this is a field". `hover:bg-accent/40` at 40% opacity is too subtle on the muted table row. | Add a `ring-1 ring-transparent focus-within:ring-ring` border affordance or increase hover background to `hover:bg-accent/70`. |
| 14 | WARNING | Auth | LoginPage.tsx:43, RegisterPage.tsx:47 | 6 — Experience / States | Generic network-error copy: `'Something went wrong. Please try again.'` — flagged by anti-template policy. | Differentiate: e.g., `'Could not reach the server. Check your connection and try again.'` |
| 15 | NOTE | Archive | ArchivePage.tsx:106 | 2 — Spacing & Rhythm | Body padding is `p-4` (16 px) while the page header uses `px-6 py-4` (24 px horizontal). The content well is 8 px narrower than the header — creates a stepped misalignment at the list border. | Change body padding to `px-6 py-4` or `p-6` to match the header horizontal rhythm. |
| 16 | NOTE | Recurring | RecurringPage.tsx:539 | 2 — Spacing & Rhythm | Same `p-4` vs `px-6` mismatch as Archive — table container has `p-4` body but `px-6 py-4` header. | Same fix: use `px-6 py-4` on the body wrapper. |
| 17 | NOTE | Auth | AuthLayout.tsx:12 | 5 — Cross-Surface Consistency | Auth pages use `font-bold` for the brand h1; all secondary-page h1s (`text-2xl font-bold`) are consistent with `TaskListPage.tsx:103`. Auth is the outlier in that its brand h1 doubles as the only heading — a structural inconsistency vs. in-app pages where h1 = page function. | Not a token issue but an architectural one. Address with finding #7 above (demote brand name to logotype role). |
| 18 | NOTE | Topics | TopicListPage.tsx:24 | 3 — Accessibility | `<Button size="sm">` contains both a `<Plus>` icon and the text "New Task". The icon has no `aria-hidden="true"`. Screen readers will announce both the SVG (silently) and the text — harmless but noisy in some AT implementations. | Add `aria-hidden="true"` to the `<Plus>` icon. |
| 19 | NOTE | Recurring | RecurringPage.tsx:280 | 4 — Token-Adherence | Column resize handle uses `transition-colors` without a duration — falls back to Tailwind's `150ms` default. The chassis defines no `--duration-*` tokens. This is not a blocker but means motion timing is implicitly hardcoded via Tailwind default. | Define `--duration-fast: 150ms` in `index.css` and reference via `transition-colors duration-[var(--duration-fast)]` or a custom utility. |
| 20 | NOTE | All secondary | — | 5 — Cross-Surface Consistency | All four secondary surfaces share `px-6 py-4 border-b border-border` header shell and `text-2xl font-bold` h1 — consistent with `TaskListPage`. Token usage is clean: zero raw hex/rgb across all four surfaces. Chassis token adherence is otherwise strong. | No action needed — document as a positive baseline. |

---

## Top 5 Ranked Findings

1. **BLOCKER #1+#2 (Auth first impression — anti-template)** `AuthLayout.tsx:9,12` — Auth surface is a textbook template clone: generic app name `"Todo"`, flat gray centered card, zero brand signal, no depth. First-impression failure; violates anti-template policy on all four required quality dimensions simultaneously.

2. **BLOCKER #4 (Icon-only buttons missing accessible names)** `RecurringPage.tsx:516–531` — Three icon-only action buttons (Pencil, Trash2, Check) have only `title` attributes. Keyboard and AT users cannot determine their purpose. WCAG 2.1 SC 4.1.2 failure.

3. **BLOCKER #3 (Magic z-index bypassing token system)** `RecurringPage.tsx:127` — `zIndex: 9999` is the only raw inline style value in the codebase that escapes the token chassis. Sets a precedent for unbounded z-index stacking.

4. **WARNING #10 (Non-interactive div acting as toggle)** `ArchivePage.tsx:38` — Expand/collapse div has no keyboard access. Archived tasks with subtasks are unexpandable for keyboard users.

5. **WARNING #11 (Touch-inaccessible Restore action)** `ArchivePage.tsx:67–76` — Restore button is opacity-0 by default and hover-revealed only. No tap/touch equivalent — action permanently hidden on mobile.

---

## Needs Human Review

- Contrast of `text-muted-foreground` (`220 2% 45%`) against `bg-muted` (`220 2% 96%`) on archive row subtitles and recurring frequency labels — WCAG AA requires 4.5:1 for normal text; computed value needs tooling verification.
- Keyboard focus-ring visibility on the `EditableSelectCell` span and `RecurringTopicSelector` div (both custom interactive elements without native focus styles).
- Screen-reader announcement order on the auth error paragraph (static a11y grep cannot confirm live-region behavior).
- `RequireAuth.tsx:32` — `return null` during token refresh results in a blank screen with no loading indicator. Duration on a slow connection is unknown; may constitute a perceptible blank flash (CLS/UX concern, needs real-device check).
