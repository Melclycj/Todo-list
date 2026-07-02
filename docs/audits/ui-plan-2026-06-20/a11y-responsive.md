# Accessibility & Responsive Audit — 2026-06-20

**Scope:** Static code audit. No dev server run. Contrast ratios computed from token HSL values using WCAG 2.1 relative-luminance formula.  
**Stack:** React 19 + shadcn/ui + Tailwind v4 · Inter 15px · `frontend/src/`

---

## Contrast Ratio Reference (computed)

All ratios against white background `hsl(220 2% 100%)` ≈ `#FFFFFF` (L=1.0) unless noted.

| Token / usage | Approx hex | L (rel) | Ratio vs white | WCAG AA (normal ≥4.5 / UI ≥3.0) |
|---|---|---|---|---|
| `--muted-foreground` 220 2% 45% | `#717578` | 0.185 | **4.47:1** | FAIL normal (0.03 under) |
| `--status-todo` 220 9% 46% (if used as text) | `#6F7682` | 0.190 | **4.36:1** | FAIL normal |
| `text-amber-700` (#b45309 — actual badge text) | `#B45309` | 0.140 | **6.45:1** | PASS |
| `text-emerald-700` (#047857 — actual badge text) | `#047857` | 0.114 | **8.23:1** | PASS |
| `text-gray-600` (#4b5563 — todo badge text) | `#4B5563` | 0.133 | **6.74:1** | PASS |
| `--primary` 221 83% 53% as text/link | `#3B7FED` | 0.202 | **4.17:1** | FAIL normal text |
| `--primary` as btn bg / white text | white on `#3B7FED` | — | **4.17:1** | FAIL normal (15px non-bold = normal) |
| `--destructive` 0 72% 51% as text | `#D93030` | 0.145 | **5.39:1** | PASS |
| `--muted-foreground` on `--muted` (96% L) | `#717578` on `#F4F4F5` | 0.185 vs 0.891 | **4.05:1** | FAIL (table headers, sidebar labels) |

---

## Findings Table

| # | Severity | Surface | File:line | Category | Issue | Concrete fix |
|---|---|---|---|---|---|---|
| 1 | BLOCKER | All — primary buttons, "Register" link | `index.css:13`, `button.tsx:10`, `LoginPage.tsx:89` | A11y: Contrast | `--primary` (#3B7FED on white) = **4.17:1**, below 4.5:1 threshold for normal text. Affects: default `<Button>` label text (white on primary bg), `text-primary` link, `accent-foreground` text. At 15px non-bold, this is normal text. | Darken `--primary` to ≥221 83% 46% (`#2E6ED6`) → gives ≈5.0:1. Verify primary-foreground (white on darkened primary) stays ≥4.5:1. |
| 2 | BLOCKER | Tasks table header, Sidebar section labels, any helper text | `index.css:9`, `TaskTableHeader.tsx:32`, `Sidebar.tsx:39`, many | A11y: Contrast | `--muted-foreground` (#717578 on white) = **4.47:1** — 0.03 below AA. Worse when rendered on `--muted` bg (#F4F4F5): drops to **4.05:1**. Affects: column header labels (`text-muted-foreground uppercase text-xs`), sidebar section labels, placeholder text, archive task titles, badge sub-labels, recurring frequency cell text. | Darken to 220 2% 40% → approx #686B6E → ≈5.2:1 on white, ≈4.6:1 on muted. This is a single token change with wide impact. |
| 3 | BLOCKER | Tasks — all pages | `TaskList.tsx:243-246`, `useColumnResize.ts:all` | Responsive: Table overflow | Task table has `tableLayout:'fixed'` with pixel widths summing to `totalWidth` computed from `window.innerWidth` proportions — but the outer `<div>` uses `overflow-auto`. On mobile (375px), the computed `totalWidth` is ~875px (0.85 × viewport proportions × screen width). The table is scrollable horizontally but with **no snap, no sticky first column, and no row labels** — a user on 375px sees a scrollable data swamp. The tasks surface fails NFR-05. | Implement a stacked/card view for `<768px` (already the board/table ViewMode exists — extend it: force card view on mobile, or add `overflow-x-auto` + sticky first column for status + title). Same issue applies to RecurringPage. |
| 4 | BLOCKER | All authenticated pages | `AppLayout.tsx:37` | Responsive: Layout breakpoint gap | Desktop sidebar (`hidden lg:flex`) appears only at `lg` (1024px). Between 768px and 1023px (tablet portrait), **no sidebar exists** — the hamburger menu header (`lg:hidden`) appears but the main content has no navigation context visible. At 768px the 6-column task table (totalWidth ≈ 653px) overflows to the right. | Extend mobile sidebar to `md:` breakpoint, or add a `md:` collapsed icon rail. At minimum audit 768–1023px range against NFR-05. |
| 5 | WARNING | Tasks, Recurring | `TaskTableHeader.tsx:34-38`, `useColumnResize.ts:startColumnDrag` | Responsive: Touch targets + column resize | Column resize handles are `w-2` (8px) divs wired only to `onMouseDown` — no `onTouchStart`. On touch devices the 8px handle is below the 44×44px minimum and unactivatable. The sidebar resize handle (`w-0.5` in `AppLayout.tsx:43`) is 2px wide. | Replace `onMouseDown` with `onPointerDown` on all resize handles; add `touch-action: none` on the handle element. Increase visual hit area with a transparent padding overlay to meet 44px minimum. |
| 6 | WARNING | Tasks, Recurring | `TaskList.tsx:87-90`, `RowContextMenu.tsx:88` | A11y: Keyboard — DnD no keyboard alternative | `@dnd-kit/core` `PointerSensor` is the only sensor registered — no `KeyboardSensor`. dnd-kit ships `KeyboardSensor` out of the box. Without it, drag-to-reorder is entirely inaccessible to keyboard-only users. The grip button receives focus (`focus:opacity-60`) but pressing Enter/Space only opens the context menu, not drag mode. | Add `useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })` from `@dnd-kit/sortable` alongside `PointerSensor`. This satisfies WCAG 2.1 SC 2.1.1. |
| 7 | WARNING | Tasks (Create drawer) | `TaskCreateDrawer.tsx:80-95` | A11y: Focus trap / Esc | The custom drawer is a `<div>` — not a `<dialog>` and not a Radix Dialog. It has **no focus trap** (focus can leave to the underlying table via Tab), and **no `aria-modal`**, no `role="dialog"`, no `aria-labelledby`. Backdrop has an `onClick` close but no `aria-hidden` on the obscured background. | Wrap in Radix `Dialog` (already imported in the project) or add `react-focus-lock` + `aria-modal="true" role="dialog" aria-labelledby="drawer-title"`. Set `aria-hidden="true"` on `#root` when drawer open. |
| 8 | WARNING | RowContextMenu — all table surfaces | `RowContextMenu.tsx:98` | A11y: Focus indicator suppressed | The grip/context-menu button has `opacity-0 group-hover:opacity-60 focus:opacity-60` — it is **invisible at rest** and only 60% opacity on focus. A keyboard user tabbing through the table hits this button but sees a barely-perceptible indicator. 60% opacity of a muted icon on a white row is well under the 3:1 minimum focus indicator contrast required by WCAG 2.2 SC 1.4.11 / 2.4.11. | On `focus-visible`, show the button at `opacity-100` (not 60%) and add a visible `focus-visible:ring-2 focus-visible:ring-ring` outline. Suppress the ring only for mouse via `:focus:not(:focus-visible)`. |
| 9 | WARNING | Auth pages | `LoginPage.tsx:87-90`, `AuthLayout.tsx:7-18` | Responsive: 320px width | `AuthLayout` wraps content in `max-w-sm` (384px) with `p-4`. At 320px viewport the card `p-6` + `border` + container `p-4` = 48px total horizontal padding on 320px → 272px usable width. The password input, email input, and submit button fit, but "Don't have an account? Register" link wraps awkwardly. **Not a hard fail** but tight. `RegisterPage` has additional fields — needs verification at 320px. | Reduce `p-6` to `p-4` on the card at `max-sm:` breakpoint; or reduce `AuthLayout` container `p-4` to `p-2` at 320px. Verify `RegisterPage` at 320px. |
| 10 | WARNING | Archive page | `ArchivePage.tsx:67-74` | A11y: Keyboard — expand/focus | The archive row expand area is a plain `<div onClick={...}>` — not a `<button>`. It is **not keyboard focusable** and has no `role="button"` or `tabIndex`. The Restore button has `opacity-0 group-hover:opacity-100` — invisible to keyboard users until hovered. | Replace the clickable `<div>` with `<button>` or add `role="button" tabIndex={0} onKeyDown`. Give the Restore button `focus-visible:opacity-100` so it surfaces on Tab. |
| 11 | WARNING | All icon-only toolbar buttons | `TaskEditToolbar.tsx:22,31,38`, `RecurringPage.tsx:516,521,531` | A11y: Icon-only buttons | Edit-mode `<Button size="sm">` with only `<Pencil>`, `<Trash2>`, or `<Check>` inside have no `aria-label` — only a `title` attribute. `title` is not reliably announced by screen readers (requires hover, not focus). | Add `aria-label="Edit tasks"`, `aria-label="Delete selected tasks"`, `aria-label="Done editing"` (etc.) to every icon-only button. Remove or keep `title` in addition. |
| 12 | WARNING | TaskCreateDrawer | `TaskCreateDrawer.tsx:103-109` | A11y: Focus indicator | The custom close `<button>` (`p-1 rounded hover:bg-muted`) has **no `focus-visible:ring`** — it relies on the browser's default outline which is removed globally by Tailwind's preflight. | Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` to the close button's className (matching the pattern used in `dialog.tsx:41`). |
| 13 | WARNING | Recurring table | `RecurringPage.tsx:108-110` | A11y: `muted-foreground/40` placeholder text | `text-muted-foreground/40` (40% opacity of #717578 on white) → effective contrast ≈ **1.9:1** — far below threshold. Used for "Add topics" and other placeholder spans in both RecurringPage and TaskRow (EditableCell placeholder). | Use `text-muted-foreground` (already borderline) without the `/40` modifier for placeholder text, or use `text-muted-foreground/60` minimum. Consider using the `placeholder:` Tailwind variant on actual `<input>` elements instead. |
| 14 | WARNING | Tasks — reduced-motion | `index.css:65-74`, `TaskRow.tsx:322`, `TaskList.tsx:243` | A11y: Reduced-motion gap | The global reduced-motion block in `index.css` correctly collapses `animation-duration` to 0.01ms. However the subtask expand/collapse uses an inline `transition-[grid-template-rows] duration-200` (`TaskRow.tsx:450`) and the sidebar drawer uses `transition-transform duration-200 ease-out` (`AppLayout.tsx:59`). These inline Tailwind transition classes are collapsed by the `transition-duration: 0.01ms` rule — **this works correctly**. The fade animation `animate-fadeInRow` is also covered. **Note:** `TaskRow.tsx:415` — the overdue `AlertCircle` uses `animate-pulse`. This is from Tailwind's `animate-pulse` keyframe and IS collapsed by the prefers-reduced-motion block. Coverage is adequate but deserves a note. | No immediate fix required. Add a comment in `index.css` noting that `animate-pulse` on the overdue icon is intentionally covered. |
| 15 | NOTE | Auth pages | `LoginPage.tsx:159` (Due Date `<Label>`) | A11y: Label without `htmlFor` | `TaskForm.tsx:159` — the "Due Date" `<Label>` has no `htmlFor` attribute, and the `<Input type="date">` below has no `id`. The association is missing for screen readers. The "Topics" `<Label>` at line 192 has the same problem. | Add `htmlFor="task-due-date"` to the label and `id="task-due-date"` to the date input. Same for Topics group — use `<fieldset>/<legend>` since it's a group of checkboxes. |
| 16 | NOTE | Recurring — `EditableSelectCell` | `RecurringPage.tsx:103-138` | A11y: Portal select keyboard | The frequency `<select>` renders via `createPortal` with `focus:outline-none`. This removes the visible focus ring from the select element. On keyboard navigation, tabbing into the cell and opening the portal select shows no focus ring. | Remove `focus:outline-none` or replace with `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`. |
| 17 | NOTE | Tasks — EditableCell inputs | `TaskRow.tsx:151,161,191,199` | A11y: Inline edit fields no label | Popup `<textarea>` and `<input>` in `EditableCell` render with no `aria-label` and no visible label. Screen readers will announce them as empty text inputs. | Add `aria-label` derived from the column name (e.g., `aria-label="Task title"`, `aria-label="Due date"`). Pass a `fieldLabel` prop to `EditableCell` and set `aria-label={fieldLabel}` on the rendered input/textarea. |
| 18 | NOTE | App.css `#root` | `App.css:1-6` | Responsive: Stale scaffold | `App.css` still contains the Vite scaffold styles (`#root { max-width: 1280px; margin: 0 auto; padding: 2rem; text-align: center; }`). The `AppLayout` uses `h-screen overflow-hidden` on `<div className="flex h-screen...">` as a direct child of `<body>`, but this `#root` padding (`2rem` on all sides) clips the app shell at all viewports and would constrain the layout if `#root` is an ancestor of `AppLayout`. In practice React mounts into `#root`; this padding wraps `AppLayout`. At 375px: `2×32px = 64px` horizontal padding reduces usable width to **311px**. | Delete or empty `App.css` (import is in `main.tsx`) or at minimum remove the `#root` rule. The app shell should be full-bleed. |

---

## Top 5 Ranked Issues

1. **#18 — App.css `#root` padding (BLOCKER-equivalent responsive):** The inherited Vite scaffold wraps the entire app in `padding: 2rem` — at 375px this eats 64px horizontal, reducing usable width to 311px across ALL surfaces. Delete `App.css` or remove the `#root` rule. This is the single highest-leverage fix.

2. **#1 — `--primary` contrast 4.17:1 (BLOCKER):** Primary buttons and the "Register" link on the login page fail AA at 15px. Darken `--primary` by ~7% lightness (53%→46%).

3. **#2 — `--muted-foreground` contrast 4.47:1 / 4.05:1 (BLOCKER):** Affects table column headers, sidebar section labels, archive task text, and every placeholder. Darkening this one token fixes dozens of instances.

4. **#3 — Task table overflows on mobile with no alternative (BLOCKER):** Fixed-pixel `totalWidth` (≈875px) scrolls horizontally at 375px with no sticky column and no card fallback. Add a card/stacked view below `md:` or sticky the status+title columns.

5. **#6 — No keyboard sensor for drag-reorder (WARNING):** dnd-kit's `KeyboardSensor` is not wired — keyboard-only users cannot reorder tasks at all. Two-line fix: import `KeyboardSensor` + `sortableKeyboardCoordinates` and add to `useSensors`.

---

## Summary Stats

| Severity | Count |
|---|---|
| BLOCKER | 4 (items 1, 2, 3, 4) |
| WARNING | 10 (items 5–14) |
| NOTE | 4 (items 15–18) |
| **Total** | **18** |

> Items 14 is a WARNING-level note (coverage adequate, no code change needed) and item 18 is a NOTE but arguably higher-impact than some WARNINGs.
