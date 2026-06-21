# UI Consistency & Token-Adherence Audit
**Date:** 2026-06-20 | **Scope:** `frontend/src` | **Theme:** Light-only (no `.dark` block)

---

## Section 1 — Token-Adherence Drift (hardcoded color values)

| # | Severity | Area | File:line | Issue | Concrete fix |
|---|----------|------|-----------|-------|--------------|
| 1 | WARNING | App.css boilerplate | `App.css:15` | `filter: drop-shadow(0 0 2em #646cffaa)` — Vite scaffold hex | Delete entire `App.css` (file is dead — never imported) |
| 2 | WARNING | App.css boilerplate | `App.css:18` | `filter: drop-shadow(0 0 2em #61dafbaa)` — Vite scaffold hex | Delete entire `App.css` |
| 3 | WARNING | App.css boilerplate | `App.css:41` | `color: #888` — Vite scaffold `.read-the-docs` text | Delete entire `App.css` |
| 4 | WARNING | Status badge | `components/ui/badge.tsx:14` | `bg-gray-100 text-gray-600` for `todo` variant — raw palette, not `--status-todo` token | Use `bg-[hsl(var(--status-todo)/0.15)] text-[hsl(var(--status-todo))]` or expose `--color-status-todo` in `@theme` |
| 5 | WARNING | Status badge | `components/ui/badge.tsx:15` | `bg-amber-100 text-amber-700` for `in-progress` — raw palette | Use `--status-in-progress` token equivalents (expose via `@theme`) |
| 6 | WARNING | Status badge | `components/ui/badge.tsx:16` | `bg-emerald-100 text-emerald-700` for `done` — raw palette | Use `--status-done` token equivalents |
| 7 | WARNING | Status badge interactive | `TaskStatusBadge.tsx:5` | `bg-gray-100 text-gray-600 border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-400` for `todo` — 6 raw palette values | Wire all 6 states through `--status-*` tokens once exposed in `@theme` |
| 8 | WARNING | Status badge interactive | `TaskStatusBadge.tsx:7` | `bg-amber-100 text-amber-700 border-amber-400 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400` for `in_progress` — 6 raw palette values | Same as above |
| 9 | WARNING | Status badge interactive | `TaskStatusBadge.tsx:8` | `bg-emerald-100 text-emerald-700 border-emerald-400 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-300` for `done` — 6 raw palette values | Same as above |
| 10 | NOTE | Dead component status | `TaskStatusCircle.tsx:5` | `border-gray-400 hover:border-amber-500` — raw palette in unused component | Delete `TaskStatusCircle.tsx` (component is never imported anywhere in the codebase) |
| 11 | NOTE | Dead component status | `TaskStatusCircle.tsx:6` | `border-amber-500 bg-amber-100 hover:border-emerald-500` — raw palette in unused component | Delete `TaskStatusCircle.tsx` |
| 12 | NOTE | Dead component status | `TaskStatusCircle.tsx:7` | `bg-emerald-500 border-emerald-500` — raw palette in unused component | Delete `TaskStatusCircle.tsx` |
| 13 | NOTE | Overlay backdrop | `AppLayout.tsx:52` | `bg-black/40` mobile sidebar backdrop — no token for scrim | Add `--color-scrim: 0 0% 0%` to token set; use `bg-[hsl(var(--scrim)/0.40)]`. Low urgency — scrim is universally black across design systems |
| 14 | NOTE | Overlay backdrop | `TaskCreateDrawer.tsx:84` | `bg-black/30` drawer backdrop — inconsistent opacity vs `AppLayout.tsx` (`/40` vs `/30`) | Unify to one scrim token at consistent opacity |
| 15 | NOTE | Overlay backdrop | `components/ui/dialog.tsx:18` | `bg-black/50` dialog overlay — third distinct opacity for scrim | Unify all three scrim uses (`.40`, `.30`, `.50`) to single `--color-scrim` token at one opacity |
| 16 | NOTE | Drop-indicator | `TaskRow.tsx:314` | `hsl(var(--primary))` in inline `boxShadow` string — uses token correctly but inline style bypasses Tailwind | Acceptable as-is; `boxShadow` with dynamic top/bottom cannot use Tailwind class. No fix required |
| 17 | NOTE | Drop-indicator | `TaskRow.tsx:316` | Same as above (bottom variant) | No fix required |

---

## Section 2 — Arbitrary Tailwind Values (px and sizing drift)

| # | Severity | Area | File:line | Issue | Concrete fix |
|---|----------|------|-----------|-------|--------------|
| 18 | WARNING | Micro-typography | `TaskStatusBadge.tsx:34` | `text-[10px]` for `sm` size — hardcoded pixel below Tailwind scale | Use `text-[0.625rem]` or add `text-2xs` alias to `@theme` (current smallest is `text-xs` = 12px); or eliminate the `sm` size and rely on `text-xs` |
| 19 | WARNING | Micro-typography | `TaskTopicTags.tsx:18` | `text-[11px]` on topic badge override — bypasses type scale | Use `text-[0.6875rem]` via CSS var, or collapse to `text-xs` (12px, effectively imperceptible difference at this size) |
| 20 | WARNING | Micro-typography | `TaskTopicTags.tsx:23` | `text-[11px]` on "more" badge — same issue | Same fix as above |
| 21 | NOTE | Layout | `AppLayout.tsx:59` | `w-[260px]` mobile sidebar — pixel width | Acceptable for a fixed nav panel; consider `w-64` (256px) or add `--sidebar-width` CSS var for easier theming |
| 22 | NOTE | EditableCell height | `TaskRow.tsx:118` | `min-h-[1.25rem]` inline editable cell — matches line-height, intentional | Acceptable; 1.25rem = 20px matches `leading-5` (same file). No fix required |
| 23 | NOTE | EditableCell height | `TaskRow.tsx:394` | `min-h-[1.25rem]` disabled cell — same | Acceptable, same rationale |
| 24 | NOTE | EditableCell height | `RecurringPage.tsx:109` | `min-h-[1.25rem]` in TemplateRow | Acceptable, same rationale |
| 25 | NOTE | EditableCell height | `RecurringPage.tsx:196` | `min-h-[1.25rem]` in TemplateRow expanded | Acceptable, same rationale |
| 26 | NOTE | EditableCell height | `TaskTopicSelector.tsx:61` | `min-h-[1.25rem]` topic selector cell | Acceptable, same rationale |
| 27 | NOTE | shadcn primitive | `components/ui/textarea.tsx:11` | `min-h-[60px]` — shadcn default boilerplate | Low priority; this is the shadcn-ui scaffold default. Align with spacing token if customizing |
| 28 | NOTE | shadcn primitive | `components/ui/scroll-area.tsx:32–33` | `p-[1px]` scrollbar padding — sub-pixel precision | shadcn boilerplate; acceptable |
| 29 | NOTE | shadcn primitive | `components/ui/separator.tsx:15` | `h-[1px]` / `w-[1px]` hairline separator | shadcn boilerplate; use `border` class for semantic clarity if refactoring |
| 30 | NOTE | shadcn primitive | `components/ui/dropdown-menu.tsx:39,56` | `min-w-[8rem]` — shadcn menu min-width | shadcn boilerplate; acceptable |
| 31 | NOTE | shadcn primitive | `components/ui/dialog.tsx:35` | `left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` — centering trick | shadcn boilerplate; no Tailwind class for fractional translate exists; acceptable |
| 32 | NOTE | shadcn primitive | `components/ui/scroll-area.tsx:14` | `rounded-[inherit]` — inherits parent radius | shadcn boilerplate; correct pattern |
| 33 | NOTE | Icon padding | `TaskStatusCircle.tsx:36` | `p-[2px]` SVG icon padding in dead component | Delete `TaskStatusCircle.tsx` |

---

## Section 3 — Cross-Surface Consistency

| # | Severity | Area | File:line | Issue | Concrete fix |
|---|----------|------|-----------|-------|--------------|
| 34 | WARNING | Page heading | `ArchivePage.tsx` (heading element) | `text-2xl font-bold` — missing `text-foreground` present on TaskListPage and TopicListPage | Add `text-foreground` to ArchivePage and RecurringPage headings for explicit token coverage (currently relies on inherited body color) |
| 35 | WARNING | Page heading | `RecurringPage.tsx` (heading element) | Same: `text-2xl font-bold` without `text-foreground` | Add `text-foreground` |
| 36 | WARNING | Empty-state CTA | `TaskEmptyState.tsx` (CTA button) | CTA rendered as raw `<button>` with manual `text-primary hover:underline` — not using shadcn `Button` with `variant="link"` | Replace with `<Button variant="link" size="sm">` for consistency with the button system |
| 37 | WARNING | Scrim opacity | `AppLayout.tsx:52` vs `TaskCreateDrawer.tsx:84` vs `dialog.tsx:18` | Three different backdrop opacities (`/40`, `/30`, `/50`) for visually identical overlay use cases | Pick one value (suggest `/50` matching dialog) and apply uniformly via a scrim token |
| 38 | WARNING | Drawer close button | `TaskCreateDrawer.tsx` (close button) | Raw `<button className="p-1 rounded hover:bg-muted ...">` — bypasses Button component | Replace with `<Button variant="ghost" size="icon">` |
| 39 | WARNING | Select elements | `TaskFilterDropdown.tsx`, `ViewModeDropdown.tsx`, `TaskForm.tsx`, `RecurringPage.tsx` (EditableSelectCell) | Four separate native `<select>` elements with individually hand-coded className strings — no shared Select primitive | Create a shared `Select` primitive (or use shadcn's) and replace all four call sites |
| 40 | NOTE | Subtask inputs | `SubtaskTable.tsx` (add/edit inputs) | Raw `<input>` elements bypass the `Input` UI primitive | Replace with `<Input>` component for consistency |
| 41 | NOTE | Sidebar inputs | `SidebarTopicList.tsx` (rename/create form inputs) | Raw `<input>` elements with manual styling | Replace with `<Input>` component |
| 42 | NOTE | Shadow scale | `LoginPage.tsx:47`, `RegisterPage.tsx:51` | `shadow-sm` on auth card; `shadow-xl` on drawer; `shadow-lg` on drag clone; `shadow-md` on popup editors | No shadow token/scale defined — four shadow levels used ad-hoc. Define `--shadow-card`, `--shadow-overlay`, `--shadow-popup` in the token set |
| 43 | NOTE | Heading scale | `TaskCreateDrawer.tsx` (drawer title) | `font-semibold text-foreground` with no size class (inherits 15px body) vs page headings at `text-2xl` | Add `text-sm` or `text-base` explicitly to drawer header title for legibility |
| 44 | NOTE | Dead code | `TaskStatusCircle.tsx` (entire file) | Component defined but never imported — confirmed by grep across all TSX | Delete file |
| 45 | NOTE | Dead code | `TaskRowExpanded.tsx` (entire file) | Component defines a full edit form but `TaskRow` never renders it — subtask expansion goes to `SubtaskTable` instead | Confirm deletion or restore if board/expansion mode is planned |
| 46 | NOTE | Unimplemented feature | `ViewModeDropdown.tsx` + `TaskListPage.tsx` | "Task Board" option exposed in UI and `viewMode` state saved to localStorage, but `TaskList` never receives `viewMode` prop and renders no board layout | Either remove the board option from the dropdown (NOTE becomes WARNING if left in production) or pass `viewMode` through and implement |

---

## Section 4 — Dark Mode

| # | Severity | Area | File:line | Issue | Concrete fix |
|---|----------|------|-----------|-------|--------------|
| 47 | NOTE | Dark mode coverage | `index.css` (entire file) | Zero `dark:` Tailwind variants found anywhere in the codebase. No `.dark` block in `index.css`. No theme toggle component or `isDark`/`setTheme` logic anywhere. | App is intentionally light-only. No action needed unless dark mode is planned — if so, add a `.dark` block in `index.css` defining all CSS custom properties and audit all `bg-gray-*`/`bg-amber-*`/`bg-emerald-*` hardcodes in `TaskStatusBadge` and `badge.tsx` which will not adapt |
| 48 | NOTE | Status colors in dark | `TaskStatusBadge.tsx` + `badge.tsx` | If dark mode is ever added: `bg-gray-100`, `bg-amber-100`, `bg-emerald-100` are light-mode palette values with no dark counterpart. They will appear washed-out or invisible on dark backgrounds | Migrate to semantic `--status-*` CSS vars (defined in `index.css`) so a single `.dark` block remaps them |

---

**7 hardcoded-color drifts** (items 1–3 in App.css dead code + items 4–9 in status badge raw palette + items 13–15 scrim inconsistency = 15 color-related items total; counting only items with a concrete color value: #646cffaa, #61dafbaa, #888, 9× raw-palette Tailwind names, 3× bg-black) **— 3 arbitrary-size drifts** (text-[10px], text-[11px]×2) outside of accepted shadcn boilerplate, **12 consistency gaps** (items 34–46, excluding dark-mode notes).

> Note: `hsl(var(--primary))` in `TaskRow.tsx:314,316` uses the token system correctly inside an inline `boxShadow` string and is not counted as a drift.
