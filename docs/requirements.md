# Todo List App — Requirements

> **Status:** Draft — v0.4
> **Last Updated:** 2026-06-21

---

## Definitions

| Term | Definition |
|------|------------|
| **Day** | A 24-hour period from 4:00 AM to 3:59 AM the following day |
| **Today** | The current day as defined above (the active 4am–4am window) |
| **Active Task** | Any task with status `To Do` or `In Progress`, plus tasks marked `Done` within today's window |
| **Archived Task** | A task marked `Done` that has passed the 4am boundary of the day it was completed |
| **Recurring Template** | The source definition of a recurring task, from which instances are generated |
| **Recurring Instance** | A copy of a recurring template created at the start of each period |

---

## Functional Requirements

### FR-00: Authentication
**Description:** Users must register and log in before accessing the app. All data is private and scoped to the authenticated user.

**Register fields:**
| Field | Required | Notes |
|-------|----------|-------|
| Email | Yes | Unique, valid email format |
| Password | Yes | Minimum 8 characters |

**Success Criteria:**
- [x] User can register with a valid email and password
- [x] System returns a clear error if the email is already in use
- [x] User can log in with valid credentials and receive an authenticated session
- [x] System returns a generic "invalid credentials" error on failed login (does not reveal which field is incorrect)
- [x] Authenticated session persists across page refreshes via a refresh token stored in an HTTP-only cookie
- [x] User can log out; the refresh token is immediately invalidated server-side

---

### FR-01: Task Management
**Description:** Users can create, view, edit, and delete tasks.

**Fields per task:**
| Field | Required | Notes |
|-------|----------|-------|
| Title | Yes | Short text |
| Description | No | Rich or plain text |
| Due date | No | Date + optional time |
| Status | Yes | `To Do` \| `In Progress` \| `Done` |
| Topic(s) | No | Multi-select from existing topics |
| Result / outcome note | No | Only relevant when status is `Done` |

**Success Criteria:**
- [x] User can create a task with at minimum a title
- [x] User can edit any field of an existing task
- [x] User can delete a task with a confirmation prompt
- [x] All changes persist after page refresh
- [x] User can view all tasks in a list view

---

### FR-02: Task Status & Archiving
**Description:** Users can update the status of a task. `Done` is the terminal status. Tasks marked `Done` remain visible in the active view for the remainder of today (until 4am the following day), after which they are automatically moved to the Archive view. This is a display rule — there is no separate "Done Today" status in the data model.

**Status transitions:**
```
To Do → In Progress → Done
  ↑                    ↓
  └──── Reopen ────────┘
         (restores to To Do)
```

**Archiving rule:**
- A task marked `Done` today stays in the active view until 4am the following day.
- At 4am, all `Done` tasks from the previous day are moved to the Archive view automatically.

**Success Criteria:**
- [x] User can transition a task through statuses: `To Do` → `In Progress` → `Done`
- [x] User can add an optional result note when marking a task as `Done`
- [x] A task marked `Done` within today's window remains visible in the active view
- [x] At 4am, tasks marked `Done` in the previous day's window are automatically moved to the Archive view
- [x] Archived tasks are visible in a dedicated Archive view
- [x] User can restore (reopen) an archived task; restored tasks return to `To Do` status

---

### FR-03: Task Filtering
**Description:** Users can filter active tasks by time window relative to due date.

**Filter options:**
| Filter | Criteria |
|--------|----------|
| Today | Tasks due within today's window (4am–4am) |
| Within 3 Days | Tasks due within the next 3 days |
| Within a Week | Tasks due within the next 7 days |
| All Tasks | No date filter applied |

**Success Criteria:**
- [x] Filter controls are always visible and accessible (via dropdown above task table)
- [x] Applying a filter updates the task list immediately (no page reload)
- [x] Active filter state is visually indicated in the UI
- [x] Tasks with no due date appear only under the "All Tasks" filter
- [x] Tasks marked `Done` within today's window are included in time-based filter results

---

### FR-04: Topic Management
**Description:** Users can create and manage topics (categories/labels) and assign tasks to them. Topics are used for grouping and navigating tasks.

**Success Criteria:**
- [x] User can create, rename, and delete topics
- [x] User can assign one or more topics to a task at creation or any time after
- [x] Sidebar lists all topics; clicking a topic filters the task list to that topic
- [x] Deleting a topic does not delete associated tasks; the topic tag is removed from affected tasks
- [x] Topic filter can be combined with a time-window filter (FR-03)
- [x] Tasks marked `Done` today that belong to a topic are shown when that topic is selected

---

### FR-05: Sidebar Navigation
**Description:** A persistent sidebar provides navigation across all views, inspired by Notion's layout. A dynamic reminder banner (FR-07) is pinned to the top of the sidebar above all navigation sections.

**Sidebar layout (top to bottom):**
| Element | Type | Description |
|---------|------|-------------|
| Reminder banner | Persistent UI element | Dynamic message — see FR-07 |
| Active Tasks | Navigation | Default view — all active tasks |
| Topics | Navigation group | List of all user-created topics |
| Recurring Tasks | Navigation | View and manage all recurring templates |
| Archive | Navigation | View of all archived tasks |

**Success Criteria:**
- [x] Sidebar is always visible on desktop viewports
- [x] Reminder banner is always pinned to the top of the sidebar
- [x] Current active view/section is visually highlighted
- [x] Sidebar collapses or becomes a drawer on mobile / small screens
- [x] Navigating via sidebar does not require a full page reload

---

### FR-06: Recurring Task
**Description:** A task can be marked as recurring when creating it. Recurring tasks automatically generate a new instance at 4am on the first day of each period, regardless of whether the previous instance has been completed.

**Instance creation rules:**
- The first instance is created immediately when the user saves the recurring template.
- Each subsequent instance is created at 4am on the first day of the next period.
- If the previous instance is not yet completed, a new instance is still created on schedule.
- Each instance title uses the original title with a date postfix (e.g. `Weekly Review – 2026-02-24`).
- When an instance is marked `Done`, it follows the standard archiving rule (FR-02).

**Success Criteria:**
- [x] User can mark a task as recurring when creating it, selecting frequency: weekly, fortnightly, or monthly
- [x] The first instance is created immediately upon saving the recurring template
- [x] A new instance is created at 4am on the first day of each period, regardless of the previous instance's status
- [x] Each instance title has the original title with a date postfix
- [x] User can view all recurring templates in the sidebar Recurring Tasks section
- [x] User can change the frequency of a recurring template; the change applies from the next instance onward
- [x] User can permanently stop a recurring template; no new instances are created, existing instances are unaffected, and the template itself is not archived

---

### FR-07: Reminder
**Description:** A persistent reminder banner pinned to the top of the sidebar. It updates dynamically based on the current time and today's task progress. "Today's tasks" means tasks due within today's window (4am–4am). "Progress" is the proportion of today's tasks with status `Done`.

**Reminder rules (evaluated top to bottom; first match applies):**
| Condition | Time | Message |
|-----------|------|---------|
| More than half of today's tasks are not complete | After 1am | "What's done is done. Go to sleep and try harder tomorrow." |
| All of today's tasks are complete | After 6pm | "Good job! Now it's time to help the future you!" |
| All of today's tasks are complete | Before 6pm | "Good job! Time to take a rest and enjoy your time." |
| More than half of today's tasks are complete | After 6pm | "Need to hurry up!" |
| More than half of today's tasks are complete | Before 6pm | "Good progress, keep it up!" |
| Half or fewer of today's tasks are complete | After 6pm | "The day is ending. Manage wisely if you missed the deadline." |
| Half or fewer of today's tasks are complete | Before 6pm | "Good day. Let's keep going!" |

**Success Criteria:**
- [x] Reminder banner is displayed at all times at the top of the sidebar
- [x] Reminder message updates within 1 second of a task status change
- [x] Reminder message updates automatically at the 6pm and 1am time boundaries without a page refresh
- [x] All reminder messages use positive or neutral language

---

### FR-08: Hybrid Task Ordering
**Description:** Tasks are sorted by ascending due date by default. Tasks due on the same day can be manually reordered via drag-and-drop. Tasks with no due date are listed separately.

**Success Criteria:**
- [x] Tasks are displayed in ascending order by due date by default
- [x] User can drag and drop tasks with the same due date to reorder them within that group
- [x] Manual ordering persists after page refresh
- [x] System prevents drag-and-drop across date groups (each group is an independent sortable context)
- [x] Tasks with no due date are listed in a separate section below dated tasks
- [x] During an active drag within a group, a 3px blue horizontal line marks the insertion edge; on drop, the task lands exactly where the line was shown immediately before release

---

### FR-09: Search Task
**Description:** Users can search for tasks by title.

**Success Criteria:**
- [x] System displays all tasks with titles matching the search query
- [x] Active filter (time window or topic) is applied to search results
- [x] System displays a "No results found" message when no tasks match

---

### FR-10: Google OpenID Login
**Description:** Users can log in using their Google account via OpenID Connect, as an alternative to email/password authentication. On first login, a user account is automatically created and linked to the Google identity. Subsequent logins match by email.

**Success Criteria:**
- [ ] A "Sign in with Google" button is displayed on the login page
- [ ] Clicking the button redirects to Google's OAuth consent screen
- [ ] After Google authorization, the user is redirected back and authenticated with a valid session
- [ ] On first Google login, a new user account is created using the Google profile email
- [ ] If a user with the same email already exists (registered via email/password), the Google identity is linked to the existing account
- [ ] Google-authenticated sessions use the same JWT/refresh token mechanism as email/password login
- [ ] User can log out from a Google-authenticated session; the refresh token is invalidated
- [ ] If Google authorization is denied or fails, the user is returned to the login page with an error message stating the reason (e.g. "Google login was cancelled" or "Authorization failed")
- [ ] The Google OAuth client ID and secret are stored as environment variables, never in source code

---

### FR-11: Subtasks
**Description:** Users can create subtasks under any task. A task with subtasks derives its status from subtask progress rather than being set directly. Subtasks are visible by expanding the parent task row. Recurring templates cannot have subtasks — only their spawned task instances can.

**Status display rules:**
| Condition | Displayed Status |
|-----------|-----------------|
| 0 subtasks completed out of m | `Not Started` |
| n subtasks completed out of m (0 < n < m) | `In Progress: n/m` |
| All subtasks completed (n = m) | `Done` |

**Expand/collapse rules:**
- A dropdown indicator is shown before the status column for tasks that have subtasks
- Clicking the task row expands it to reveal its subtask table
- Only one task can be expanded at a time; expanding another collapses the currently expanded one
- Subtasks are displayed as rows in the same table format (same columns and column widths), grouped as a sub-table with a visual gap separating it from the main task list
- Expanding works in all views: active task list, topic groups, and archive

**Subtask behavior:**
- A subtask is always associated with its parent task and cannot exist independently
- Each subtask has its own status (To Do / In Progress / Done)
- A completed subtask is never moved to the archive view or separated into its own group — it stays with its parent
- Subtasks follow the same CRUD rules as tasks (create, edit, delete) but scoped to the parent

**Success Criteria:**
- [x] User can create a subtask under any existing task (not recurring templates)
- [x] Recurring templates do not show the subtask option; their spawned instances do
- [x] A task with subtasks displays a dropdown indicator before the status column
- [x] Task status displays `Not Started`, `In Progress: n/m`, or `Done` based on subtask completion
- [x] Clicking a task row with subtasks expands it to show the subtask table
- [x] Subtask rows use the same columns and column widths as the main task table
- [x] The subtask table is visually separated from adjacent task rows (distinct border or spacing)
- [x] Only one task can be expanded at a time; expanding another collapses the previous
- [x] Completed subtasks remain with their parent — they are never archived separately
- [x] Subtasks are visible when expanding a task in any view (active, topic, archive)
- [x] Deleting a parent task deletes all its subtasks
- [x] User can edit and delete individual subtasks

---

### FR-12: Row Context Menu
**Description:** Each task row has a context menu (triggered by a "more options" icon at the start of the row) that provides quick actions. The menu options vary by row type.

**Task rows:** Delete, Add Subtask
**Recurring template rows:** Delete, Stop

**Delete behavior:**
- For tasks: same effect as deleting via the edit button (confirmation prompt, then removal)
- For recurring templates: deletes the template permanently; it is not shown in history. Existing spawned instances are unaffected.

**Stop behavior (recurring only):**
- Stops the recurring template; no new instances are created. Same effect as the existing stop action.

**Add Subtask behavior:**
- Selecting "Add Subtask" expands the task with its subtask table and creates a new empty subtask row
- The cursor is automatically placed in the title column of the new subtask row (editing state)
- If the user navigates away (scrolls away, switches tab, clicks another task to fold, or otherwise collapses the task) while the new subtask is still empty (no title entered), the empty subtask is removed and the task reverts to its previous state (no dropdown indicator if it had no other subtasks, status unchanged)

**Success Criteria:**
- [x] A "more options" icon is displayed at the start of each task row and recurring template row
- [x] Clicking the icon on a task row opens a context menu with "Delete" and "Add Subtask" options
- [x] Clicking the icon on a recurring template row opens a context menu with "Delete" and "Stop" options
- [x] "Delete" on a task removes it with a confirmation prompt, identical to the edit-button delete flow
- [x] "Delete" on a recurring template removes it permanently; it does not appear in history
- [x] "Stop" on a recurring template stops future instance creation (same as existing stop action)
- [x] "Add Subtask" expands the task and creates a new empty subtask row
- [x] The cursor is automatically focused on the title column of the new subtask
- [x] If the task is collapsed or the user navigates away while the subtask title is empty, the empty subtask is discarded
- [x] A task with no other subtasks reverts to normal display (no dropdown indicator, original status) when an empty subtask is discarded
- [x] The context menu closes when an option is selected or when clicking outside it

---

### FR-13: UI Micro-interactions & Visual Polish
**Description:** Improve the app's visual quality and dynamic feedback through micro-interactions, smoother transitions, and accessibility compliance. All animations must respect `prefers-reduced-motion`.

**Success Criteria:**
- [x] Task create drawer slides in from the right (200ms ease-out) and slides out on close
- [x] Mobile sidebar slides in from the left (200ms ease-out) with backdrop fade
- [x] Subtask expand/collapse animates height smoothly (200ms ease-out)
- [x] Status badge shows `active:scale-95` press feedback on click
- [x] Reminder banner crossfades (300ms) when message text changes
- [x] All transitions are disabled when `prefers-reduced-motion: reduce` is active
- [x] Context menu icon is visible at 30% opacity by default, 100% on hover
- [x] Task row hover state is visually distinct (`bg-muted/40`)
- [x] Search clear button fades in/out with `transition-opacity duration-150`
- [x] Table column resize handle has a wider hit area (w-2)
- [x] Empty state fades in on mount (opacity 0 to 1, 300ms)
- [x] Muted/background colors have slight warm saturation (1-2% at hue 220)
- [x] Overdue date icon uses a gentle pulse animation

---

### FR-14: Strict Task Filter Validation
**Description:** The `GET /tasks` `window` query parameter is currently typed as a plain string, so unrecognized values are silently ignored (the `TaskFilterParams` `Literal` is dead code). It must be validated so invalid values are rejected rather than returning a confusingly unfiltered list.

**Success Criteria:**
- [ ] `GET /tasks?window=<invalid>` returns a `422` validation error naming the allowed values, instead of unfiltered results
- [ ] All four valid values (`today`, `3days`, `week`, `all`) work unchanged
- [ ] Omitting `window` continues to behave as no window filter
- [ ] The endpoint uses the `TaskFilterParams` `Literal` (no dead-code schema)
- [ ] Tests cover each valid value plus at least one invalid value

---

### FR-15: SSE Reminder Authentication Fix
**Description:** The reminder SSE stream (`GET /reminder/stream`) authenticates via a `?token=` query parameter, but the backend `HTTPBearer()` dependency reads the token only from the `Authorization` header. Because `EventSource` cannot set headers, every stream connection returns `401`, and the frontend silently retries then falls back to 60-second polling. The real-time reminder feature (FR-07) is therefore effectively non-functional, and access tokens placed in URLs leak into server/proxy logs. This is a backend/auth fix and **must be routed through AppSec**.

**Success Criteria:**
- [ ] An authenticated user's `GET /reminder/stream` connection succeeds (no `401`) and receives a pushed reminder event — verified by an integration test _(needs running app — in-browser / CI)_
- [x] The access token is no longer transmitted in a URL query string (now sent in the `Authorization` header via a fetch-based stream)
- [ ] With a valid session, real-time delivery works over the stream (reminder updates within 1s of a status change per FR-07) rather than silently falling back to polling _(needs running app)_
- [x] The unit test that asserts the old `?token=` URL is updated to the new contract
- [x] No access token appears in server access logs for the stream endpoint (access log records path only; token never in URL — AppSec-confirmed)
- [x] The change is reviewed through AppSec (authentication + token-in-URL handling)

---

### FR-16: Remove Non-Functional Task Board View
**Description:** The view-mode dropdown offers a "Task Board" option that is persisted to `localStorage` but never consumed — `TaskList` renders the same list regardless of `viewMode`, so selecting "Task Board" silently does nothing. The dead control must be removed. (A real board view, if desired later, is a separate future requirement.)

**Success Criteria:**
- [x] The "Task Board" option is removed from the view-mode control
- [x] The unused `viewMode` state, the `board` value, and the now-unused `ViewMode` type are removed — no dead code remains
- [x] Every option offered by the view-mode control produces a visibly distinct rendered result, or the control is removed if only one view exists
- [x] No persisted value produces a no-op render
- [x] A test asserts the view-mode control offers only functional options

---

### FR-17: Undo & Recovery for Reversible Actions
**Description:** Reversible actions (status change, drag-reorder) offer no undo, and subtask delete fires immediately on a hover-only trash icon with no confirmation — easy accidental data loss.

> **Correction (2026-06-21):** task delete and topic delete are **permanent hard deletes** (verified in `task_repository.delete` / `subtask_repository.delete` — `session.delete(...)`); they do **not** go to the Archive. The 4am Archive only holds auto-archived *Done* tasks. Both already show an accurate "cannot be undone" confirmation, so there is nothing to "recover" and no false Archive promise should be added. True undo-of-delete would require a backend soft-delete + restore endpoint — tracked separately if wanted, out of scope here.

**Success Criteria:**
- [ ] Status change and drag-reorder each present an Undo affordance that restores the single immediately-preceding state of that entity
- [ ] Subtask delete gains a confirmation dialog (matching the task-delete confirm) before the subtask is removed
- [x] Task delete keeps a confirmation that accurately states the deletion is permanent (no false "recoverable" claim)
- [x] Topic delete shows a confirmation consistent with task delete
- [ ] E2E tests verify status-undo and reorder-undo restore prior state, and that subtask delete requires confirmation

---

### FR-18: Premium Visual Direction — "Slate Studio"
**Description:** The current chassis is generic (15px body with 1.5 line-height — too loose for dense task rows; near-zero-saturation grays with no hue identity; a 100%-saturation accent; an almost-invisible sidebar/canvas step; 8px radius). Apply the locked **"Slate Studio"** direction: a cool-leaned neutral palette, a tightened type scale, a refined accent, a smaller radius, and a visible depth ladder. Depends on FR-15-independent token work in NFR-10 landing first.

**Success Criteria:**
- [ ] Gray tokens carry a consistent cool hue lean (≈2–4% saturation at hue ~220)
- [ ] `--accent` saturation is reduced from 100% to a fixed lower target value
- [ ] `--radius` is set to 4–6px (from 8px)
- [ ] List-row body text is 13–14px with line-height ≤ 1.4
- [ ] The sidebar has a ≥3% luminance step from the main canvas
- [ ] All `transition-duration` values resolve to a small named set (≤3 tokens)
- [ ] Visual-regression baselines captured at 320/768/1440 reflect the new direction

---

### FR-19: Auth First-Impression Redesign
**Description:** The auth screens are a flat, centered gray card with a generic "Todo" wordmark and a reversed heading hierarchy (the card heading is smaller than the brand name) — a template-default first impression. Redesign for a branded, intentional entry point.

**Success Criteria:**
- [ ] Auth pages move off the centered-gray-card template (a branded split panel or a deliberate brand element)
- [ ] A real wordmark / brand mark replaces the plain "Todo" text
- [ ] The card's action heading ("Sign in" / "Create account") is the dominant heading; the brand name is demoted to a logotype role
- [ ] Auth pages pass axe-core with 0 serious/critical violations
- [ ] Visual-regression baselines captured for login and register

---

## Non-Functional Requirements

### NFR-01: Performance
**Description:** The app must feel responsive under normal and concurrent load.

**Success Criteria:**
- [x] Initial page load completes in under 2 seconds on standard broadband
- [x] Task list re-renders within 500ms after a filter change
- [ ] App sustains 100 concurrent users without response times exceeding NFR-01 targets

---

### NFR-02: Concurrency
**Description:** The server and database must handle multiple simultaneous user connections efficiently without exhausting resources or degrading response times.

**Success Criteria:**
- [x] Database connection pooling is configured and active
- [x] The server handles concurrent requests without connection exhaustion or race conditions
- [x] Connection pool size is configurable via environment variable
- [ ] Under 100 concurrent users, all response times remain within NFR-01 performance targets

---

### NFR-03: Availability & Reliability
**Description:** The app should be stable, recoverable, and fault-tolerant.

**Success Criteria:**
- [ ] 99.5% uptime target, measured via monthly monitoring report (excluding scheduled maintenance)
- [ ] Database has automated backups on a daily minimum schedule
- [x] App degrades gracefully on DB connection failure (surfaces a user-visible error; does not crash silently)
- [x] Server errors return meaningful HTTP status codes and messages

---

### NFR-04: Security
**Description:** User data is protected in transit and at rest.

**Success Criteria:**
- [x] All data in transit is encrypted via HTTPS / TLS
- [x] No sensitive data is exposed in API responses or server logs
- [x] All user inputs are validated and sanitized server-side
- [x] Authentication is required to access any task data
- [x] API endpoints are protected against unauthorized access

---

### NFR-05: Usability
**Description:** The UI should be clean, intuitive, and Notion-inspired with a clear information hierarchy.

**Success Criteria:**
- [x] A new user can create and filter a task within 60 seconds without reading documentation
- [ ] No horizontal overflow at 320, 375, and 768px on any surface (verified by responsive screenshots)
- [ ] The task list presents a card/stacked view (or sticky status+title columns) below the `md` breakpoint instead of a fixed-width horizontally-scrolling table
- [ ] Navigation is reachable on tablet (768–1023px) — a sidebar rail or extended drawer, not a gap
- [ ] All interactive targets are ≥44×44px on touch; row actions and the Archive "Restore" action are reachable without hover
- [x] Consistent visual language across the app: typography, spacing, and color system
- [x] Empty states are handled with a descriptive message (e.g. "No tasks due today")

---

### NFR-06: Maintainability
**Description:** The codebase should support rapid agile iteration with minimal regression risk.

**Success Criteria:**
- [ ] Core modules have unit test coverage >= 80%
- [x] New features can be added without modifying unrelated modules (loose coupling)
- [x] A CI/CD pipeline runs all tests automatically before any release deployment

---

### NFR-07: Query Performance Indexes
**Description:** The hot-path database indexes documented in `database.md` (under "Planned") do not exist in any migration, so high-frequency queries (task lists, scheduler scans) run unindexed. Consolidates the prior backlog item "Operations: DB performance indexes migration."

**Success Criteria:**
- [ ] An Alembic migration creates `ix_tasks_user_id_due_date`, `ix_tasks_user_id_archived`, `ix_tasks_status_archived`, `ix_task_topics_topic_id`, and the partial `ix_recurring_next_run` (`WHERE is_active = true`) — final set confirmed at implementation (standalone `ix_tasks_due_date` may be dropped as redundant with the composite)
- [ ] The migration applies cleanly and `downgrade` drops the indexes
- [ ] `database.md` moves these indexes from "Planned" to "Existing"
- [ ] `EXPLAIN` on the task-list query and the recurring-scheduler query shows index scans (not seq scans) on a seeded dataset
- [ ] The full test suite passes against the migrated schema

---

### NFR-08: Consistent API Error Envelope
**Description:** `401` (auth), `422` (request validation), and `429` (rate limit) responses bypass the standard `{success, data, error}` envelope, returning framework-default shapes instead. They should be enveloped so clients can parse every error uniformly.

**Success Criteria:**
- [ ] `401` (`HTTPException`), `422` (`RequestValidationError`), and `429` (`RateLimitExceeded`) responses return the standard envelope (`success=false`, `data=null`, string `error`)
- [ ] `422` field-level detail is surfaced in a consistent, documented shape rather than the raw FastAPI list
- [ ] Existing enveloped errors (`400`/`403`/`404`/`500`) are unchanged
- [ ] The frontend still performs silent refresh on `401` and renders validation errors correctly
- [ ] `api-spec.md` Error Handling is updated; tests assert the envelope shape for `401`, `422`, and `429`

---

### NFR-09: Accessibility Baseline (Keyboard, Names, Focus)
**Description:** Multiple WCAG 2.2 gaps surfaced in the 2026-06 UI audit: icon-only buttons expose only a `title` attribute (not reliably announced by screen readers), drag-to-reorder has no keyboard alternative, the custom task create-drawer has no focus trap, and several custom interactive elements (`<div onClick>`) are not keyboard-operable. (A contrast review found `--primary` ≈5.17:1 and `--muted-foreground` ≈4.9:1 both **pass** AA on white; only `--muted-foreground` over `bg-muted` is marginal.)

**Success Criteria:**
- [x] Every icon-only button has an `aria-label`
- [x] Drag-to-reorder is operable by keyboard (dnd-kit `KeyboardSensor` wired with `sortableKeyboardCoordinates`)
- [ ] The task create-drawer has `role="dialog"`, `aria-modal`, a focus trap, and Esc-to-close — _partial: role/aria-modal/aria-labelledby + Esc + focus-on-open done; full Tab-cycle trap deferred_
- [ ] Archive expand/collapse and all custom interactive elements are keyboard-focusable and operable, with a visible focus indicator — _archive expand + grip + restore done; remaining custom controls (e.g. topic-selector popover trigger) pending_
- [x] Task status is distinguishable without relying on color alone
- [ ] axe-core reports 0 serious/critical violations on each surface at 320, 768, and 1440px — _needs running app (CI / in-browser)_
- [x] Any token measured below 4.5:1 on its actual background (i.e. `--muted-foreground` on `bg-muted`) is darkened to pass

---

### NFR-10: Design-Token Integrity
**Description:** Status badge colors hardcode raw Tailwind palette classes (`gray-`/`amber-`/`emerald-`) and ignore the `--status-*` tokens already declared in `index.css`; overlay scrims use three different `bg-black/*` opacities; a magic `zIndex: 9999` and off-scale micro-typography bypass the token system; and several dead files remain. This must land before FR-18 (re-skinning depends on tokens being wired).

**Success Criteria:**
- [ ] Status badges render via the `--status-*` tokens (no raw status palette classes remain — grep-verified)
- [ ] A single `--overlay` token replaces all `bg-black/*` backdrops at one consistent opacity
- [ ] No inline z-index literals remain (the z-scale is tokenized)
- [ ] Dead files are removed: `App.css`, `TaskStatusCircle.tsx`, `TaskRowExpanded.tsx`
- [ ] Off-scale micro-type (`text-[10px]`, `text-[11px]`) is normalized to scale tokens
- [ ] `npm run build` and the test suite pass after the deletions

---

### NFR-11: Error States, Error Boundary & Visual Polish
**Description:** Network errors on the task and topic lists render nothing (infinite skeleton); there is **no React error boundary anywhere** (Sentry is initialized but unused), so any render exception produces a white screen; `RequireAuth` returns `null` during token refresh (blank flash); auth collapses all failures to one generic message; and several visual-hierarchy nits remain (the New Task button is not visually dominant, the header has no action/filter separation, secondary-page headers are inconsistent).

**Success Criteria:**
- [ ] An app-level error boundary (e.g. `Sentry.ErrorBoundary`) renders a fallback UI instead of a white screen on a render exception
- [ ] The task list and topic list show an error state with a retry action when the fetch fails
- [ ] `RequireAuth` shows a loading indicator (not a blank screen) during token refresh
- [ ] Auth errors differentiate network vs invalid-credential vs server failures
- [ ] The "New Task" button renders as the filled primary (`variant="default"`) while other header buttons are `ghost`/`outline`
- [ ] Filter and action header clusters are visually separated; secondary-page headers share one consistent pattern
