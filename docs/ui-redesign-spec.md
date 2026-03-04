# UI Redesign Specification

**Status:** Pending implementation
**Do not implement until approved.**

---

## Summary of Changes

All requested UI changes are listed below, categorised into **Design** and **Functional** concerns. Many items span both; they appear in the category that best describes the primary change.

---

## Design-Related Changes

### D1 — Double the Default Sidebar Width

**Current state:** The sidebar uses a fixed Tailwind width class (approximately `w-64`, ~256 px).
**Required change:** Increase the default width to approximately `w-128` (~512 px, or the equivalent in pixels/rem).

**Files affected:**
- `frontend/src/components/layout/AppLayout.tsx` — where sidebar width is applied
- `frontend/src/components/layout/Sidebar.tsx` — if width is set here instead

**Notes:** This is purely a CSS/Tailwind class change. The new default width will also serve as the starting value for the resizable sidebar (see F1).

---

### D2 — Table Layout for Task List

**Current state:** Tasks are rendered as stacked rows, each showing only the title and a few inline badges.
**Required change:** Replace the current list with a proper table UI:

| Column | Content |
|--------|---------|
| Status | Word label + clickable cycle button |
| Title  | Full task title, truncated with tooltip |
| Due Date | Date only (no time) |
| Description | Task description, truncated |

Each column has a fixed minimum width and fills available horizontal space. The table has a **sticky header row** so column labels remain visible while scrolling.

**Files affected:**
- `frontend/src/features/tasks/TaskList.tsx` — replace list with table container
- `frontend/src/features/tasks/TaskRow.tsx` — replace row layout with `<tr>` / `<td>` equivalents
- New component: `frontend/src/features/tasks/TaskTableHeader.tsx` — column header row with resize handles
- `frontend/src/features/tasks/TaskStatusCircle.tsx` — extend to display word labels (see D4)

---

### D3 — Status Displayed as Words, Not Dots

**Current state:** Status is displayed as a coloured circle (dot). Aria-label shows "Status: to do" etc.
**Required change:** Replace the dot with a pill/badge-style element displaying:

| Internal value | Displayed word |
|---------------|----------------|
| `todo`        | **Not started** |
| `in_progress` | **In progress** |
| `done`        | **Done** |

The element remains clickable to cycle status (see F3). Suggested styling: a small rounded badge with a background colour matching the current status colour scheme (grey → amber → green).

**Files affected:**
- `frontend/src/features/tasks/TaskStatusCircle.tsx` — rename/extend to `TaskStatusBadge.tsx` or add a `showLabel` prop
- All consumers of `TaskStatusCircle` in the task table row

---

### D4 — Filter Dropdown and Search Repositioned to Top-Left of Main Page

**Current state:** Date filters (Today / 3 Days / Week / All) live in the sidebar. The search bar sits above the task list independently.
**Required change:**
- Place a **Filter dropdown** at the top-left of the main content area, immediately above the task table.
- Place the **Search bar** directly to the right of the filter dropdown, in the same horizontal row.
- The rest of the header row (page title, New Task button) may stay on the right side.

Layout sketch:
```
[ Filter ▼ ]  [ 🔍 Search... ]          [ Page Title ]  [ + New Task ]
```

**Files affected:**
- `frontend/src/features/tasks/TaskListPage.tsx` — reorganise header row layout
- `frontend/src/features/tasks/TaskSearchBar.tsx` — no logic change, just repositioned
- New component: `frontend/src/features/tasks/TaskFilterDropdown.tsx` — dropdown for filter selection

---

### D5 — Remove Date Filters from Sidebar

**Current state:** The sidebar contains `NavItem` links for Today, Within 3 Days, Within a Week, and All Tasks.
**Required change:** Remove those four `NavItem` entries from the sidebar nav section entirely.

**Files affected:**
- `frontend/src/components/layout/Sidebar.tsx` — delete the four filter `NavItem` components and the `SectionLabel` that groups them (if it becomes empty)

---

### D6 — Date-Only Input When Adding a Task

**Current state:** The due-date field is `<input type="datetime-local">`, which shows a date AND time picker.
**Required change:** Change to `<input type="date">`, which shows only a calendar date picker with no hour/minute fields.

The stored value should still be a full ISO datetime (backend expects it), so the frontend should append a time of `T00:00:00` (midnight) when sending the value to the API.

**Files affected:**
- `frontend/src/features/tasks/TaskForm.tsx` — change `type="datetime-local"` to `type="date"` and adjust the value conversion

---

### D7 — Task Display Area is the Primary Space (Scrollable Both Axes)

**Current state:** The task list has vertical scroll only; horizontal overflow is clipped.
**Required change:**
- The task table should take up **all remaining vertical space** in the main content area (use `flex-1 overflow-hidden` on the wrapper and `overflow-auto` on the table container).
- Enable **both horizontal and vertical scrolling** on the table container so the user can scroll right to see all columns when the viewport is narrow.
- The sticky table header must remain fixed at the top during vertical scroll.

**Files affected:**
- `frontend/src/components/layout/AppLayout.tsx` — ensure the main content area uses `flex-col` and the task page fills available height
- `frontend/src/features/tasks/TaskListPage.tsx` — set the task list wrapper to `flex-1 overflow-hidden`
- `frontend/src/features/tasks/TaskList.tsx` — add `overflow-auto` scroll container wrapping the `<table>`

---

## Functional Changes

### F1 — Resizable Sidebar (Drag the Border)

**Behaviour:** The user can drag the right edge of the sidebar left or right to resize it. The width is clamped between a minimum (e.g. 160 px) and a maximum (e.g. 600 px). The chosen width is persisted in `localStorage` so it survives page reloads.

**Implementation approach:**
1. Replace the sidebar's fixed width class with an inline `style={{ width: sidebarWidth }}` driven by React state.
2. Render a thin vertical drag handle element (`<div>`) on the right edge of the sidebar.
3. Attach `onMouseDown` to the handle; on drag, update `sidebarWidth` via `mousemove` on `document`.
4. On `mouseup`, stop listening and save the final width to `localStorage`.
5. On mount, read the saved width from `localStorage` (fall back to the new default from D1).

**New hook:** `frontend/src/hooks/useSidebarResize.ts`
**Files affected:**
- `frontend/src/hooks/useSidebarResize.ts` — new hook encapsulating drag logic + localStorage
- `frontend/src/components/layout/AppLayout.tsx` — consume the hook, pass width to sidebar, render drag handle

---

### F2 — Resizable Table Columns (Drag Column Dividers)

**Behaviour:** Each column header has a vertical drag handle on its right edge. Dragging it left/right changes that column's width. Column widths are persisted in `localStorage`.

**Implementation approach:**
1. Store column widths in a `Record<columnKey, number>` state object (e.g. `{ status: 120, title: 300, dueDate: 120, description: 240 }`).
2. Render a `<div>` resize handle inside each `<th>`. On `mousedown`, record the start X and the column's current width.
3. On `mousemove`, compute `delta = currentX - startX` and update the column's width.
4. Apply column widths as inline `style={{ width }}` on each `<th>` and `<td>`.
5. Persist final widths to `localStorage` under a key like `taskTableColumnWidths`.

**New hook:** `frontend/src/hooks/useColumnResize.ts`
**Files affected:**
- `frontend/src/hooks/useColumnResize.ts` — new hook
- `frontend/src/features/tasks/TaskTableHeader.tsx` — new component, uses hook to render resizable `<th>` elements

---

### F3 — Status Cycle: In Progress → Done → Not Started → In Progress

**Current behaviour:** Clicking cycles: `todo → in_progress → done`, with no way to revert `done` back.
**Required change:** The cycle becomes:

```
in_progress → done → todo → in_progress → ...
```

So:
- From **In progress**: next is **Done**
- From **Done**: next is **Not started** (todo)
- From **Not started**: next is **In progress**

This means every status is reachable from every status in exactly one click, and there is no terminal state.

**Files affected:**
- `frontend/src/features/tasks/TaskRow.tsx` — update the `nextStatus()` function:
  ```typescript
  // BEFORE
  function nextStatus(current: TaskStatus): TaskStatus {
    if (current === 'todo') return 'in_progress'
    if (current === 'in_progress') return 'done'
    return 'done' // done was terminal
  }

  // AFTER
  function nextStatus(current: TaskStatus): TaskStatus {
    if (current === 'in_progress') return 'done'
    if (current === 'done') return 'todo'
    return 'in_progress' // todo → in_progress
  }
  ```
- Remove the `if (isDone) return` guard that prevented clicking on done tasks.

---

### F4 — Remove Due-Date Grouping, Keep Sorting

**Current state:** Tasks may be visually grouped by due date (today / upcoming / no date).
**Required change:** Remove any grouping logic. The task list is a flat table, sorted ascending by `due_date` (nulls last), which is already the backend sort order. No frontend grouping headers.

**Files affected:**
- `frontend/src/features/tasks/TaskList.tsx` — remove any `groupBy` logic or section headers. Render all tasks as a flat sequence of rows.

---

### F5 — Filter Dropdown Replaces URL-Based Window Filter

**Current state:** Filters are URL query params (`?window=today`, `?window=3days`, etc.) driven by sidebar NavLinks.
**Required change:**
- Replace the URL param approach with a local state dropdown in the main page header.
- Dropdown options:

| Label | Value sent to API |
|-------|------------------|
| All Tasks | *(no filter)* |
| Today | `today` |
| Within 3 Days | `3days` |
| Within a Week | `week` |

- The selected filter is stored in React state (`useState`) within `TaskListPage`, not in the URL.
- The `useTasks` hook call passes `window: selectedFilter` as before.
- Remove the `useSearchParams` import and usage from `TaskListPage`.

**Files affected:**
- `frontend/src/features/tasks/TaskListPage.tsx` — replace `useSearchParams` with `useState` for filter; add `TaskFilterDropdown`
- New component: `frontend/src/features/tasks/TaskFilterDropdown.tsx`
- `frontend/src/components/layout/Sidebar.tsx` — remove the four filter nav items (see D5)

---

## Affected Files — Complete List

| File | Change type | Notes |
|------|------------|-------|
| `frontend/src/components/layout/AppLayout.tsx` | Design + Functional | Sidebar resize hook, flex layout for full-height content |
| `frontend/src/components/layout/Sidebar.tsx` | Design | Remove date filter nav items; wider default |
| `frontend/src/features/tasks/TaskListPage.tsx` | Design + Functional | New header layout, filter state, search position |
| `frontend/src/features/tasks/TaskList.tsx` | Design + Functional | Table container, remove grouping, scrollable |
| `frontend/src/features/tasks/TaskRow.tsx` | Design + Functional | Table row layout, new status cycle |
| `frontend/src/features/tasks/TaskStatusCircle.tsx` | Design | Add word label display |
| `frontend/src/features/tasks/TaskForm.tsx` | Functional | `date` input instead of `datetime-local` |
| `frontend/src/features/tasks/TaskSearchBar.tsx` | Design | Repositioned only |
| `frontend/src/features/tasks/TaskTableHeader.tsx` | Design + Functional | **New file** — sticky column headers with resize handles |
| `frontend/src/features/tasks/TaskFilterDropdown.tsx` | Design + Functional | **New file** — filter dropdown component |
| `frontend/src/hooks/useSidebarResize.ts` | Functional | **New file** — sidebar drag-resize + localStorage |
| `frontend/src/hooks/useColumnResize.ts` | Functional | **New file** — column drag-resize + localStorage |

---

## Open Questions (to resolve before implementation)

1. **Sidebar drag handle style:** Thin visible line, or only visible on hover?
2. **Status badge size:** Full-width inside the column cell, or auto-width pill?
3. **Date format in table:** `Mar 5` / `05/03/2026` / `2026-03-05` — which locale/format?
4. **Description column:** Show raw text truncated, or a tooltip/popover on hover for the full text?
5. **Empty description:** Show a dash `—` or leave blank?
6. **Filter persistence:** Should the selected filter survive page reload (localStorage), or reset to "All Tasks" on each visit?
7. **"Not started" label spelling:** The request uses "Not start" — confirm whether "Not started" is preferred.
