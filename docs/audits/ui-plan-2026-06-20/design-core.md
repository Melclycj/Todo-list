# Design Audit — Core Surfaces
**Audited:** 2026-06-21 | **Baseline:** index.css @theme tokens (HSL vars, --radius .5rem, Inter 15px, status colors)
**Surfaces:** tasks (TaskListPage + 17 children), shell (AppLayout + Sidebar), reminder (ReminderBanner)
**Screenshots:** not captured (no dev server — code-only audit)
**axe:** static-only (no dev server)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Visual Hierarchy | 2/4 | Header mixes primary action (New Task) with secondary toolbar items at identical visual weight; no landmark hierarchy below h1 |
| 2. Spacing & Rhythm | 2/4 | Dual row-height registers (py-2 parent rows vs py-1.5 subtask rows) create rhythm but subtask indent is only 4px border-l-2 ml-4; uniform px-3 column padding is mechanically repetitive |
| 3. Accessibility | 2/4 | Icon-only buttons use `title=` not `aria-label`; `animate-pulse` on AlertCircle fires without reduced-motion guard (CSS global guard only covers own @keyframes, not Tailwind's animate-pulse); TopicSelector PopoverTrigger wraps a `<div>`, not a `<button>` |
| 4. Token-Adherence | 2/4 | Status colors (gray-/amber-/emerald- palette classes) hardcoded in 3 files instead of --status-todo/in-progress/done tokens; backdrop overlays use raw `bg-black/30` and `bg-black/40` |
| 5. Cross-Surface Consistency | 3/4 | Shell and tasks share token colors and type scale well; only divergence is TaskCreateDrawer uses `shadow-xl` while AppLayout drag-overlay uses `shadow-lg` — minor, no chassis break |
| 6. Experience / States | 3/4 | Loading (Skeleton), error (toast), empty (TaskEmptyState) all handled; gap: TaskList shows no network-error state if `useTasks` returns isError; delete-confirm dialog copy is precise |

**Overall: 14/24** — **Verdict: CONDITIONAL (≥14, no single-pillar score 1)**

---

## Findings Table

| # | Severity | Surface | File:line | Pillar | Issue | Concrete fix |
|---|----------|---------|-----------|--------|-------|--------------|
| 1 | BLOCKER | tasks/status | `TaskStatusBadge.tsx:5-8`, `TaskStatusCircle.tsx:5-7`, `components/ui/badge.tsx:14-16` | 4 Token-Adherence | Status colors hardcoded as raw Tailwind palette (`bg-gray-100 text-gray-600`, `bg-amber-100 text-amber-700`, `bg-emerald-100 text-emerald-700`) across 3 files, bypassing the `--status-todo`, `--status-in-progress`, `--status-done` CSS tokens declared in index.css. Any theme or saturation change to tokens has zero effect. | Replace palette classes with `bg-[hsl(var(--status-todo)/0.15)]`, `text-[hsl(var(--status-todo))]` etc., or add `--color-status-*` entries to @theme and use `bg-status-todo/15`. |
| 2 | BLOCKER | shell, tasks/drawer | `AppLayout.tsx:52`, `AppLayout.tsx:59`, `TaskCreateDrawer.tsx:84` | 4 Token-Adherence | Modal/sidebar overlays use raw `bg-black/40` and `bg-black/30`. `dialog.tsx:18` also uses `bg-black/50`. Black is not registered in @theme; it defeats dark-mode / contrast-mode theming. | Add `--overlay: 0 0% 0%` to :root and `--color-overlay: hsl(var(--overlay))` to @theme. Use `bg-overlay/40` etc., or use `bg-foreground/40` (foreground inverts correctly in themes). |
| 3 | BLOCKER | tasks/toolbar | `TaskEditToolbar.tsx:22`, `TaskEditToolbar.tsx:35`, `TaskEditToolbar.tsx:40` | 3 Accessibility | Three icon-only `<Button>` elements (Pencil, Trash2, Check) carry only `title="…"` not `aria-label`. The `title` attribute is not reliably announced by screen readers and fails WCAG 1.3.1 / 4.1.2. | Replace `title="Edit tasks"` with `aria-label="Edit tasks"` on all three; add `<span className="sr-only">` inside if needed. |
| 4 | WARNING | tasks/row | `TaskRow.tsx:415` | 3 Accessibility | `<AlertCircle className="animate-pulse">` applies Tailwind's built-in `animate-pulse` animation. The global `@media (prefers-reduced-motion: reduce)` guard in index.css only suppresses custom `@keyframes` declared there; Tailwind's `animate-pulse` uses its own `@keyframes pulse` which is NOT covered unless Tailwind is configured to respect `prefers-reduced-motion`. `TaskDueDateDisplay.tsx:32` has the same issue. | Add `motion-safe:animate-pulse` class (Tailwind's built-in motion-safe variant) or configure Tailwind `theme.extend.animation` to use `prefers-reduced-motion` media via custom keyframes. Two sites: `TaskRow.tsx:415`, `TaskDueDateDisplay.tsx:32`. |
| 5 | WARNING | tasks/topic | `TaskTopicSelector.tsx:58-65` | 3 Accessibility | `<PopoverTrigger asChild>` wraps a `<div>` element. `<div>` is not interactive; Radix promotes it to a button role, but it has no `tabIndex` and the `div` carries no `aria-label`. Keyboard users may not be able to reach the topic picker. | Change the `<div>` to `<button type="button">` (or add `role="button" tabIndex={0}` and `aria-label="Edit topics"`) so focus order is correct. |
| 6 | WARNING | tasks/page | `TaskListPage.tsx:104-114` | 1 Visual Hierarchy | Header row places `<h1>` (24px bold), `<Button> New Task` (primary), and `<TaskEditToolbar>` (icon-only outline) inside one `flex items-center gap-3` row at the same level. New Task and the edit toolbar are visually indistinguishable in weight — both are small outline/ghost buttons. Primary action (New Task) should be visually dominant. | Give New Task a filled primary variant (`variant="default"`) or increase its size to `size="default"`. The edit-mode button should remain `variant="ghost"` or `size="icon"`. |
| 7 | WARNING | tasks/header | `TaskListPage.tsx:99-121` | 1 Visual Hierarchy | Right-hand toolbar (`ViewModeDropdown`, `TaskFilterDropdown`, `TaskSearchBar`) sits in the same header row as the h1 and action buttons with no visual separator or grouping. At full width this is fine, but there is no visual hierarchy cue distinguishing "navigation/filter" from "create/edit". | Add a thin `<Separator orientation="vertical" className="h-5 mx-1" />` between the left action cluster and right filter cluster, or move filters below the header into a sub-bar with a border-b. |
| 8 | WARNING | tasks/status | `TaskStatusBadge.tsx:5-8` | 2 Spacing & Rhythm | `py-0.5` (2px top+bottom) badge height with `text-xs` (12px) produces a 16px click target for the status cycle button. WCAG 2.5.5 recommends 24×24px minimum for pointer targets; 44×44px is ideal. The small badge is the primary status control on each row. | Increase to `px-2.5 py-1` or add a transparent padding wrapper. At minimum `min-h-[24px]` on the badge button. |
| 9 | WARNING | tasks/subtask | `subtask-styles.ts:2` | 2 Spacing & Rhythm | Subtask rows are indented via `ml-4` (16px) + `border-l-2` (2px). At 15px base font and 60px+ parent row height, 18px total indent is thin and doesn't visually communicate hierarchy clearly. The `bg-muted/5` is imperceptible (5% opacity). | Increase indent to `ml-6` (24px) or `ml-8` (32px); raise `bg-muted/5` to `bg-muted/20` for a visible nesting depth cue. |
| 10 | WARNING | tasks/table | `TaskTableHeader.tsx:32` | 2 Spacing & Rhythm | Column resize handles (`w-2` = 8px) are always visible as `bg-border` strips. This creates visual clutter on a tight table — 5 permanent vertical divider-hits per header that shift visual weight. | Make resize handles `opacity-0 hover:opacity-100 group-hover:opacity-100` matching the grip icon pattern used elsewhere in the same surface. |
| 11 | WARNING | tasks/row | `TaskRow.tsx:314-317` | 4 Token-Adherence | Drop indicator uses inline style `hsl(var(--primary))` via JS string — correct token reference, but applied as `boxShadow` inline style, not a Tailwind utility. This breaks PurgeCSS static analysis and is inconsistent with the token-via-utility pattern used everywhere else on the surface. | Extract to a Tailwind arbitrary `shadow-[inset_0_3px_0_0_hsl(var(--primary))]` class or (better) add a `@utility drop-indicator-above` in index.css. |
| 12 | WARNING | tasks/toolbar | `TaskEditToolbar.tsx:22` | 6 Experience / States | Enter-edit-mode button is an icon-only Pencil with no visible text label at any state. There is no tooltip (only `title=`). First-time users have no discovery path to bulk-delete mode. | Add a visible label `<span className="sr-only md:not-sr-only">Select</span>` or a Tooltip component wrapping the button. |
| 13 | WARNING | tasks/list | `TaskList.tsx:209-217` | 6 Experience / States | Loading state shows 5 skeleton rows regardless of previous task count. If the user had 50 tasks, the skeleton flashes as an obviously different height. | Store last task count in a ref or localStorage and render `Math.max(5, lastCount)` skeletons, capped at 20. |
| 14 | WARNING | tasks/list | `TaskList.tsx` (no `isError` branch) | 6 Experience / States | `useTasks` can return `isError: true` but `TaskList` and `TaskListPage` have no error UI branch. The component simply shows the loading skeleton indefinitely or an empty state with no indication of network failure. | Add `const { data, isLoading, isError } = useTasks(...)` check; render an error state (`<p>Failed to load tasks — <button>Retry</button></p>`) when `isError`. |
| 15 | NOTE | tasks/type | `TaskTopicTags.tsx:18,23` | 4 Token-Adherence | `text-[11px]` is an arbitrary off-scale font size. The token chassis only declares Inter at 15px base; `text-xs` = 12px is the Tailwind minimum on the type scale. 11px is a one-off. | Use `text-xs` (12px) and rely on `py-0` to keep badge compact; or add `--text-tag: 11px` to @theme if truly needed. |
| 16 | NOTE | shell/sidebar | `Sidebar.tsx:96-97` | 1 Visual Hierarchy | Stale comment `// Placeholder — SidebarTopicList is built in Phase 4` was left in production file. Not a UX defect but signals the file hasn't been cleaned post-sprint. | Remove the stale comment. |
| 17 | NOTE | tasks/row | `TaskRow.tsx:118` | 2 Spacing & Rhythm | `min-h-[1.25rem]` is an arbitrary rem value. The same pattern is repeated identically in `RecurringPage.tsx:109,196` and `TaskTopicSelector.tsx:61`. This repeated magic constant should be a named utility. | Extract to `@utility editable-cell-min-h { min-height: 1.25rem; }` in index.css or a shared className constant. |
| 18 | NOTE | tasks/row | `TaskRow.tsx:318` | 2 Spacing & Rhythm | `animationDelay: \`${staggerIndex * 40}ms\`` is a raw magic number (40ms per row) applied as inline style. Not wrapped in a token. | Add `--stagger-step: 40ms` to :root if stagger delay is a design decision worth preserving, or move to a CSS variable in @theme. |
| 19 | NOTE | reminder | `ReminderBanner.tsx:28` | 4 Token-Adherence | `transition-opacity duration-300` uses a hardcoded Tailwind duration class. No `--duration-*` tokens are defined in index.css, so this is consistent with the rest of the codebase — but the codebase uniformly uses hardcoded duration classes. Consider adding `--duration-fast: 150ms; --duration-normal: 300ms` to :root per the web/coding-style.md guideline. | Tracked as NOTE since there is no duration token system to violate yet — the finding is to prompt token adoption. |
| 20 | NOTE | tasks/subtask | `SubtaskTable.tsx:127` | 3 Accessibility | The persistent "add subtask" input (`placeholder="+ Add subtask..."`) has no visible label, only a placeholder. Placeholders disappear on input, leaving the field without context. | Add a visually hidden `<label htmlFor="add-subtask-input" className="sr-only">Add subtask</label>` and `id="add-subtask-input"` on the input. |

---

## Blockers (must fix before ship)

1. **Status color token bypass** — `TaskStatusBadge.tsx:5-8`, `TaskStatusCircle.tsx:5-7`, `badge.tsx:14-16` — hardcoded `gray-/amber-/emerald-` Tailwind palette ignores `--status-todo/in-progress/done` tokens; any design token update has no effect — **Replace with `hsl(var(--status-*))` or @theme entries.**
2. **Raw `bg-black` overlay** — `AppLayout.tsx:52,59`, `TaskCreateDrawer.tsx:84`, `dialog.tsx:18` — `black` is not in @theme; theming/contrast-mode cannot override overlay darkness — **Register `--overlay` in :root + @theme; use `bg-overlay/N`.**
3. **Icon-only buttons with only `title=`** — `TaskEditToolbar.tsx:22,35,40` — `title` not reliably announced by screen readers; fails WCAG 4.1.2 — **Replace all three with `aria-label`.**

---

## Warnings (fix recommended)

- **animate-pulse missing motion-safe guard** — `TaskRow.tsx:415`, `TaskDueDateDisplay.tsx:32` — Tailwind's `animate-pulse` keyframes are not suppressed by the global reduced-motion rule in index.css — use `motion-safe:animate-pulse`.
- **TopicSelector PopoverTrigger wraps `<div>`** — `TaskTopicSelector.tsx:59` — keyboard inaccessible; change to `<button>` or add `role="button" tabIndex={0} aria-label`.
- **New Task button indistinct from toolbar** — `TaskListPage.tsx:104` — use `variant="default"` (filled) for primary create action vs `variant="outline"` for secondary edit.
- **Status badge click target too small** — `TaskStatusBadge.tsx` — 16px effective target on the primary row action; increase to `min-h-[24px]`.
- **Subtask indent too tight and background imperceptible** — `subtask-styles.ts:2` — `ml-4 bg-muted/5` doesn't communicate nesting depth; increase to `ml-6` and `bg-muted/20`.
- **Column resize handles always visible** — `TaskTableHeader.tsx:32` — permanent `bg-border` strips create visual noise; mirror grip's `opacity-0 group-hover:opacity-100` pattern.
- **Drop indicator as inline JS string** — `TaskRow.tsx:314-317` — `hsl(var(--primary))` in a boxShadow string; extract to Tailwind utility.
- **Edit-mode entry has no visible label or tooltip** — `TaskEditToolbar.tsx:22` — icon-only pencil with no visible text; add Tooltip or visible label.
- **Loading skeleton count fixed at 5** — `TaskList.tsx:211` — jarring height mismatch for large task lists.
- **No error UI branch in TaskList** — `TaskList.tsx` — network error produces no user-visible feedback.

---

## Needs Human Review (machine-undecidable)

- **Keyboard focus order through the table** — with resizable columns and drag handles, the tab order may skip or repeat cells; needs interactive keyboard traversal test.
- **Color contrast of status badges** — `text-gray-600 on bg-gray-100`, `text-amber-700 on bg-amber-100`, `text-emerald-700 on bg-emerald-100` — estimated ratios ~4.5:1 but need measured verification with a contrast tool against the actual rendered 15px font.
- **Focus visibility on inline EditableCell editors** — the popup textarea/input uses `focus:outline-none` without a replacement focus ring; needs visual confirmation that `ring-ring` is perceptible.
- **Row density at smaller viewports** — the fixed-width table scrolls horizontally on mobile but the experience needs human evaluation; `w-[260px]` sidebar + px-3 column padding stack may make the table unusable below 768px.
- **Drag-and-drop affordance discoverability** — the grip icon is `opacity-0` until hover; touch/mobile users who lack hover state cannot discover reordering.

---

## Detailed Findings by Pillar

### Pillar 1: Visual Hierarchy (2/4)

The `h1` at `text-2xl font-bold` correctly anchors the page. However the action row (`TaskListPage.tsx:102-121`) puts the primary CTA (New Task `size="sm"`) and secondary edit-mode toggle (Pencil `size="sm" variant="outline"`) at identical size and visual weight — standard anti-template complaint: "Uniform radius, spacing, and shadows across every component." The right-hand filter cluster has no visual grouping (no separator, no background change) differentiating it from the action cluster. The empty state heading (`font-medium`, `text-sm` description) has appropriate hierarchy inside its container. Sidebar `NavItem` active state uses `bg-accent + border-l-2 border-primary` — good affordance, properly differentiated from hover.

### Pillar 2: Spacing & Rhythm (2/4)

Task rows use `py-2` (8px top+bottom, 16px total), subtask rows use `py-1.5` (6px, 12px total) — intentional hierarchy, positive signal. Column padding is uniformly `px-3` across all 5 data columns: consistent but flat. `SubtaskTable` persistent add-input row and pending-new-subtask row also use `py-1.5` — consistent. The stagger animation delay is `40ms * index` (raw inline style, no token). The `min-h-[1.25rem]` magic value appears in 4+ places across features (`TaskRow.tsx:118,394`, `TaskTopicSelector.tsx:61`, `RecurringPage.tsx:109,196`). Spacing scale diversity: py-0, py-0.5, py-1, py-1.5, py-2, py-4, py-5 — seven distinct y-padding values across the table surface, which is above the typical 3-4 needed for a well-governed rhythm; some consolidation would tighten the design.

### Pillar 3: Accessibility (2/4)

Positives: expand/collapse chevron buttons have proper `aria-label` (`TaskRow.tsx:361-362`); `TaskStatusBadge` has `aria-label="Status: …"` (`TaskStatusBadge.tsx:38`); `TaskStatusCircle` has `aria-label` (`TaskStatusCircle.tsx:32`); `RowContextMenu` grip has `aria-haspopup="menu"` and `aria-expanded` (`RowContextMenu.tsx:99-101`); reduced-motion guard exists in index.css for custom keyframes; `TaskSearchBar` clear button has `aria-label="Clear search"`.

Failures (counted): 3 icon-only buttons with only `title=` (BLOCKER); `animate-pulse` without `motion-safe:` guard on 2 elements; `<div>` as PopoverTrigger child in TopicSelector; persistent subtask input has no label. The `focus:outline-none` on inline editors in `TaskRow.tsx:151,170,191,210` removes the browser default ring without consistently replacing it — only some have `ring-1 ring-ring` and only when `editing===true`; display mode span has no focus ring at all.

### Pillar 4: Token-Adherence (2/4)

The chassis defines `--status-todo: 220 9% 46%`, `--status-in-progress: 38 92% 50%`, `--status-done: 160 84% 39%` in index.css. None of these are consumed by any component. Instead, 3 files hardcode raw Tailwind palette classes: `bg-gray-100 text-gray-600 border-gray-300` (todo), `bg-amber-100 text-amber-700 border-amber-400` (in_progress), `bg-emerald-100 text-emerald-700 border-emerald-400` (done). These palette classes bear no relationship to the token values (e.g. `--status-todo` is 220 9% 46% — a dark gray, not `gray-600` which is 220 9% 46% approximately — they happen to be close but are disconnected). The overlay color (`bg-black`) appears in 3 files. Only 2 occurrences of `var(--` found in TSX/TS (both in `TaskRow.tsx:314,316` for the drop indicator, correctly using `hsl(var(--primary))`). `transition-colors duration-150`, `duration-200`, `duration-300` appear 10+ times — no `--duration-*` tokens exist yet, so this is a gap in the token system itself, not a consumer violation.

### Pillar 5: Cross-Surface Consistency (3/4)

Three surfaces (tasks, shell, reminder) share: `text-foreground` / `text-muted-foreground` / `bg-muted` / `border-border` semantic tokens consistently; `text-sm` / `text-xs` type scale; `rounded-md` as the dominant radius. `TaskCreateDrawer` uses `shadow-xl` while `TaskList` drag overlay uses `shadow-lg`; minor but noted. Reminder banner uses `border-primary bg-accent` — consistent with sidebar active item pattern. `AppLayout.tsx:81` mobile top bar brand text `font-semibold` matches `Sidebar.tsx:60` app name `text-xl font-bold` but drops the size — readable divergence but expected. No chassis break detected.

### Pillar 6: Experience / States (3/4)

Loading: `TaskList` renders 5 `Skeleton` rows — good. Subtask create shows `isPending` state. Drawer buttons show `isPending` text transitions (e.g. "Deleting…"). Empty: `TaskEmptyState` covers 7 distinct empty-state variants with context-appropriate icons and copy — well above baseline. Error: individual mutations all route to `toast.error(...)` — visible feedback. Gap: `useTasks` network error is not caught at the list level (no `isError` branch in `TaskList.tsx` or `TaskListPage.tsx`). Destructive: `BulkDeleteDialog` shows count, warns "cannot be undone", requires explicit confirmation — correct. Generic copy check: "New Task", "Create Task", "Delete" are specific; no "Submit" / "Click here" found.

---

## Surfaces Audited

| File | Lines | Notes |
|------|-------|-------|
| `features/tasks/TaskListPage.tsx` | 152 | page root |
| `features/tasks/TaskList.tsx` | 307 | DnD orchestrator + table |
| `features/tasks/TaskRow.tsx` | 484 | row + EditableCell |
| `features/tasks/TaskTableHeader.tsx` | 44 | sticky thead |
| `features/tasks/SubtaskTable.tsx` | 148 | subtask table + inputs |
| `features/tasks/SubtaskRow.tsx` | 101 | subtask row |
| `features/tasks/TaskStatusBadge.tsx` | 43 | status badge button |
| `features/tasks/TaskStatusCircle.tsx` | 43 | status circle (alternate) |
| `features/tasks/TaskEditToolbar.tsx` | 45 | bulk edit toolbar |
| `features/tasks/RowContextMenu.tsx` | 158 | grip + context menu |
| `features/tasks/ViewModeDropdown.tsx` | 35 | view mode select |
| `features/tasks/TaskFilterDropdown.tsx` | 37 | filter window select |
| `features/tasks/TaskSearchBar.tsx` | 36 | search input |
| `features/tasks/TaskTopicSelector.tsx` | 97 | topic popover |
| `features/tasks/TaskTopicTags.tsx` | 29 | topic badge display |
| `features/tasks/TaskCreateDrawer.tsx` | 125 | slide-in create drawer |
| `features/tasks/TaskEmptyState.tsx` | 68 | empty/zero state |
| `features/tasks/BulkDeleteDialog.tsx` | 47 | confirm dialog |
| `features/tasks/TaskDueDateDisplay.tsx` | 36 | due date chip |
| `features/tasks/subtask-styles.ts` | 2 | shared wrapper class |
| `components/layout/AppLayout.tsx` | 91 | shell layout |
| `components/layout/Sidebar.tsx` | 95 | navigation sidebar |
| `features/reminder/ReminderBanner.tsx` | 35 | SSE reminder |
| `components/ui/badge.tsx` | 33 | badge variants |

---

## Top 5 Findings (Ranked by Impact)

1. **Status colors bypass tokens** (`TaskStatusBadge.tsx:5-8`, `TaskStatusCircle.tsx:5-7`, `badge.tsx:14-16`) — BLOCKER — the entire status color system is disconnected from the declared tokens; theme changes silently fail.
2. **Raw `bg-black` overlay color** (`AppLayout.tsx:52`, `TaskCreateDrawer.tsx:84`) — BLOCKER — hardcodes an absolute color not in @theme, defeating any future contrast-mode or theme override.
3. **Icon-only buttons use `title=` not `aria-label`** (`TaskEditToolbar.tsx:22,35,40`) — BLOCKER — screen readers will not reliably announce the button purpose.
4. **`animate-pulse` without `motion-safe:` guard** (`TaskRow.tsx:415`, `TaskDueDateDisplay.tsx:32`) — WARNING — motion plays for users who have requested reduced motion; index.css global guard does not cover Tailwind's built-in `animate-pulse`.
5. **No network error state in TaskList** (`TaskList.tsx`) — WARNING — a failed API fetch leaves users staring at an empty or loading state with no recovery path.
