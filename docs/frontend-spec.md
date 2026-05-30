# Frontend Specification

---

## Project Structure

```
frontend/src/
├── main.tsx
├── App.tsx                   # Router setup
├── api/                      # API client (one file per domain)
│   ├── client.ts             # Axios instance + interceptors
│   ├── tasks.ts, topics.ts, archive.ts, recurring.ts, subtasks.ts, reminder.ts, auth.ts
├── hooks/                    # TanStack Query hooks wrapping api/ calls
│   ├── useTasks.ts, useTopics.ts, useSubtasks.ts, useRecurring.ts, useReminder.ts, useAuth.ts
├── features/                 # Domain-scoped components and pages
│   ├── tasks/ (TaskRow, TaskList, SubtaskTable, SubtaskRow, SubtaskListReadonly, subtask-styles, RowContextMenu, useDateGroups, ...)
│   ├── topics/, archive/, recurring/, auth/
├── components/               # Shared UI components
│   ├── layout/ (Sidebar, AppLayout)
│   └── ui/ (shadcn/ui re-exports)
├── lib/utils.ts              # cn helper
└── types/                    # Shared TypeScript types
```

---

## State Management

No global client-side store (no Redux, no Zustand).

| State type | Managed by |
|------------|------------|
| Server data (tasks, topics, archive) | TanStack Query |
| UI state (modal open, form input) | Local `useState` |
| Auth token | HTTP-only cookie (refresh) + memory (access) |
| Filter selection | Local `useState` + localStorage |

---

## API Communication Rules

- All API calls go through `src/api/client.ts` (Axios instance)
- Interceptors attach access token to every request
- On `401`: silent token refresh, then retry once
- On failed refresh: redirect to login
- No component may call `fetch` or `axios` directly (the reminder SSE `EventSource` connection is the sole exception — see Reminder section)

---

## Reminder (SSE)

- `GET /api/v1/reminder/stream` — Server-Sent Events; live push with a polling fallback only in degraded mode (see below)
- Server pushes on: task status change, 6pm/1am time boundaries
- Frontend opens SSE on mount, fetches initial via `GET /api/v1/reminder`
- **Auth:** `EventSource` cannot set headers, so the in-memory access token is passed as a `?token=` query param on the stream URL (with `withCredentials` for the refresh cookie). This is the one API call that does not go through the Axios client.
- **Reconnection:** on error the client closes the stream and runs its own exponential backoff (`1s × 2^n`, up to 3 retries); native `EventSource` auto-retry is disabled
- **Fallback:** after 3 failed retries it stops reconnecting and polls `GET /reminder` every 60s instead

---

## Routing

| Path | View |
|------|------|
| `/login` | Login page |
| `/register` | Register page |
| `/` | Active tasks (default: All Tasks filter) |
| `/topics/:id` | Tasks filtered by topic |
| `/recurring` | Recurring templates |
| `/archive` | Archive view |
| `*` | Any unmatched path redirects to `/` |

Filter window is managed via local state + localStorage, not URL params.
