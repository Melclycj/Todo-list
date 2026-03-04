# Todo List App — Requirements

> **Status:** Draft — v0.3
> **Last Updated:** 2026-02-24

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
- [ ] User can register with a valid email and password
- [ ] System returns a clear error if the email is already in use
- [ ] User can log in with valid credentials and receive an authenticated session
- [ ] System returns a generic "invalid credentials" error on failed login (does not reveal which field is incorrect)
- [ ] Authenticated session persists across page refreshes via a refresh token stored in an HTTP-only cookie
- [ ] User can log out; the refresh token is immediately invalidated server-side

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
- [ ] User can create a task with at minimum a title
- [ ] User can edit any field of an existing task
- [ ] User can delete a task with a confirmation prompt
- [ ] All changes persist after page refresh
- [ ] User can view all tasks in a list view

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
- [ ] User can transition a task through statuses: `To Do` → `In Progress` → `Done`
- [ ] User can add an optional result note when marking a task as `Done`
- [ ] A task marked `Done` within today's window remains visible in the active view
- [ ] At 4am, tasks marked `Done` in the previous day's window are automatically moved to the Archive view
- [ ] Archived tasks are visible in a dedicated Archive view
- [ ] User can restore (reopen) an archived task; restored tasks return to `To Do` status

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
- [ ] Filter controls are always visible and accessible from the sidebar
- [ ] Applying a filter updates the task list immediately (no page reload)
- [ ] Active filter state is visually indicated in the UI
- [ ] Tasks with no due date appear only under the "All Tasks" filter
- [ ] Tasks marked `Done` within today's window are included in time-based filter results

---

### FR-04: Topic Management
**Description:** Users can create and manage topics (categories/labels) and assign tasks to them. Topics are used for grouping and navigating tasks.

**Success Criteria:**
- [ ] User can create, rename, and delete topics
- [ ] User can assign one or more topics to a task at creation or any time after
- [ ] Sidebar lists all topics; clicking a topic filters the task list to that topic
- [ ] Deleting a topic does not delete associated tasks; the topic tag is removed from affected tasks
- [ ] Topic filter can be combined with a time-window filter (FR-03)
- [ ] Tasks marked `Done` today that belong to a topic are shown when that topic is selected

---

### FR-05: Sidebar Navigation
**Description:** A persistent sidebar provides navigation across all views, inspired by Notion's layout. A dynamic reminder banner (FR-07) is pinned to the top of the sidebar above all navigation sections.

**Sidebar layout (top to bottom):**
| Element | Type | Description |
|---------|------|-------------|
| Reminder banner | Persistent UI element | Dynamic message — see FR-07 |
| Active Tasks | Navigation | Default view — all active tasks |
| Filters | Navigation group | Today / Within 3 Days / Within a Week / All Tasks |
| Topics | Navigation group | List of all user-created topics |
| Recurring Tasks | Navigation | View and manage all recurring templates |
| Archive | Navigation | View of all archived tasks |

**Success Criteria:**
- [ ] Sidebar is always visible on desktop viewports
- [ ] Reminder banner is always pinned to the top of the sidebar
- [ ] Current active view/section is visually highlighted
- [ ] Sidebar collapses or becomes a drawer on mobile / small screens
- [ ] Navigating via sidebar does not require a full page reload

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
- [ ] User can mark a task as recurring when creating it, selecting frequency: weekly, fortnightly, or monthly
- [ ] The first instance is created immediately upon saving the recurring template
- [ ] A new instance is created at 4am on the first day of each period, regardless of the previous instance's status
- [ ] Each instance title has the original title with a date postfix
- [ ] User can view all recurring templates in the sidebar Recurring Tasks section
- [ ] User can change the frequency of a recurring template; the change applies from the next instance onward
- [ ] User can permanently stop a recurring template; no new instances are created, existing instances are unaffected, and the template itself is not archived

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
- [ ] Reminder banner is displayed at all times at the top of the sidebar
- [ ] Reminder message updates within 1 second of a task status change
- [ ] Reminder message updates automatically at the 6pm and 1am time boundaries without a page refresh
- [ ] All reminder messages use positive or neutral language

---

### FR-08: Hybrid Task Ordering
**Description:** Tasks are sorted by ascending due date by default. Tasks due on the same day can be manually reordered via drag-and-drop. Tasks with no due date are listed separately.

**Success Criteria:**
- [ ] Tasks are displayed in ascending order by due date by default
- [ ] User can drag and drop tasks with the same due date to reorder them within that group
- [ ] Manual ordering persists after page refresh
- [ ] System prompts the user if a drag-and-drop action would violate date-based ordering (e.g. dragging a task above one with an earlier due date)
- [ ] Tasks with no due date are listed in a separate section below dated tasks

---

### FR-09: Search Task
**Description:** Users can search for tasks by title.

**Success Criteria:**
- [ ] System displays all tasks with titles matching the search query
- [ ] Active filter (time window or topic) is applied to search results
- [ ] System displays a "No results found" message when no tasks match

---

## Non-Functional Requirements

### NFR-01: Performance
**Description:** The app must feel responsive under normal and concurrent load.

**Success Criteria:**
- [ ] Initial page load completes in under 2 seconds on standard broadband
- [ ] Task list re-renders within 500ms after a filter change
- [ ] App sustains 100 concurrent users without response times exceeding NFR-01 targets

---

### NFR-02: Concurrency
**Description:** The server and database must handle multiple simultaneous user connections efficiently without exhausting resources or degrading response times.

**Success Criteria:**
- [ ] Database connection pooling is configured and active
- [ ] The server handles concurrent requests without connection exhaustion or race conditions
- [ ] Connection pool size is configurable via environment variable
- [ ] Under 100 concurrent users, all response times remain within NFR-01 performance targets

---

### NFR-03: Availability & Reliability
**Description:** The app should be stable, recoverable, and fault-tolerant.

**Success Criteria:**
- [ ] 99.5% uptime target, measured via monthly monitoring report (excluding scheduled maintenance)
- [ ] Database has automated backups on a daily minimum schedule
- [ ] App degrades gracefully on DB connection failure (surfaces a user-visible error; does not crash silently)
- [ ] Server errors return meaningful HTTP status codes and messages

---

### NFR-04: Security 
**Description:** User data is protected in transit and at rest.

**Success Criteria:**
- [ ] All data in transit is encrypted via HTTPS / TLS
- [ ] No sensitive data is exposed in API responses or server logs
- [ ] All user inputs are validated and sanitized server-side
- [ ] Authentication is required to access any task data
- [ ] API endpoints are protected against unauthorized access

---

### NFR-05: Usability
**Description:** The UI should be clean, intuitive, and Notion-inspired with a clear information hierarchy.

**Success Criteria:**
- [ ] A new user can create and filter a task within 60 seconds without reading documentation
- [ ] UI is responsive across desktop, tablet, and mobile viewports
- [ ] Consistent visual language across the app: typography, spacing, and color system
- [ ] Empty states are handled with a descriptive message (e.g. "No tasks due today")

---

### NFR-06: Maintainability
**Description:** The codebase should support rapid agile iteration with minimal regression risk.

**Success Criteria:**
- [ ] Core modules have unit test coverage ≥ 80%
- [ ] New features can be added without modifying unrelated modules (loose coupling)
- [ ] A CI/CD pipeline runs all tests automatically before any release deployment
