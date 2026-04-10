# Sprint Board

## Rules

- **Map to `requirements.md`, don't duplicate.** Sprint scope references requirement IDs (e.g. FR-08, NFR-05) and adds sprint-specific sub-tasks. Full success criteria live in `requirements.md` only — tick them off there when complete.
- **One file.** All sprints live here. Past sprints are collapsed under `<details>`.
- **3-5 items per sprint, 2-week cycles.**
- **Sprint goal** = one sentence describing the theme.
- At sprint end: move incomplete items back to backlog top, add a brief retro note.

---

## Current Sprint

**Sprint 2** | Goal: Frontend polish — mobile layout, drag-and-drop, and micro-interactions
**Started:** 2026-04-10

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | Mobile sidebar collapse/drawer | FR-05 | Done |
| 2 | Drag-and-drop reordering for same-day tasks | FR-08 | Done |
| 3 | Slide animations for drawer and sidebar, subtask expand/collapse animation | FR-13 | Done |
| 4 | Status badge feedback, reminder crossfade, reduced-motion support | FR-13 | Done |
| 5 | Visual polish: row hover, context menu opacity, search transition, resize handle, empty state fade, warm palette, overdue pulse | FR-13 | Done |

### Retrospective

**What went well:**
- FR-05 (mobile sidebar) was already implemented from a prior sprint — just needed the criterion ticked off. Free win.
- @dnd-kit integrated cleanly with the existing table layout using per-date-group SortableContexts, preventing cross-group drags structurally rather than with prompts.
- All 13 FR-13 micro-interaction criteria implemented in two focused tasks (animations + visual polish), each with its own commit.
- prefers-reduced-motion support added globally in one CSS block — covers all current and future animations.

**Problems encountered:**
- Subtask expand animation required refactoring SubtaskTable to support an `isInner` prop so the outer `<tr><td colSpan>` wrapper could be managed by TaskRow (needed for the CSS grid-template-rows trick on a table row).
- Forgot to commit after Task 1 and Task 2 individually — batched them retroactively. Sprint workflow rule already covered this; need to follow it more strictly.

**Spec deviations:** FR-08 criterion "System prompts the user if a drag-and-drop action would violate date-based ordering" was updated to "System prevents drag-and-drop across date groups" — structural prevention is better UX than a prompt.

---

## Backlog (prioritized — next sprint picks from top)

- FR-10: Google OpenID login
- NFR-05: Responsive layout for tablet + mobile
- NFR-06: Reach 80% test coverage
- Operations: DB performance indexes migration

---

## Completed Sprints

<details>
<summary>Sprint 1 — Subtasks, context menu, and recurring task bug fix (2026-04-05 to 2026-04-10)</summary>

**Sprint 1** | Goal: Subtasks, context menu, and recurring task bug fix
**Started:** 2026-04-05

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | Row context menu for tasks and recurring templates | FR-12 | Done |
| 2 | Subtask creation, display, expand/collapse, and derived status | FR-11 | Done |
| 3 | Fix: recurring instances not created at scheduled frequency | FR-06 | Done |
| 4 | Fix: frequency change not applying from next instance onward | FR-06 | Done |

### Retrospective

**What went well:**
- Full subtask feature delivered end-to-end (migration, ORM, service, API, UI) with derived status display
- Recurring task bugs (catch-up loop, frequency recalculation) fixed with good unit test coverage
- Context menu reusable across task rows and recurring template rows

**Problems encountered:**
- Alembic migration for subtasks initially failed due to `sa.Enum` trying to recreate the existing `taskstatus` PostgreSQL enum; fixed by using `postgresql.ENUM(..., create_type=False)`
- `docker compose down -v` (used to fix stale node_modules) wiped the postgres data volume, requiring re-registration
- Recurring catch-up test off-by-one: `<=` boundary meant 4 instances created, not 3

**What was fixed post-review:**
- FR-11 criterion "Subtasks visible in any view (active, topic, archive)" was failing — archive page had no expand/collapse. Added `SubtaskListReadonly` component and shared `subtask-styles.ts` to fix.

**Spec deviations:** None — all success criteria satisfied after post-review fix.

</details>
