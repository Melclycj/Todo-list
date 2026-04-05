# Frontend Specification

---

## Project Structure

```
frontend/src/
├── main.tsx
├── App.tsx                   # Router setup
├── api/                      # API client (one file per domain)
│   ├── client.ts             # Axios instance + interceptors
│   ├── tasks.ts, topics.ts, archive.ts, recurring.ts, reminder.ts, auth.ts
├── hooks/                    # TanStack Query hooks wrapping api/ calls
│   ├── useTasks.ts, useTopics.ts, useReminder.ts, useAuth.ts
├── features/                 # Domain-scoped components and pages
│   ├── tasks/, topics/, archive/, recurring/, auth/
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
- No component may call `fetch` or `axios` directly

---

## Reminder (SSE)

- `GET /api/v1/reminder/stream` — Server-Sent Events, no polling
- Server pushes on: task status change, 6pm/1am time boundaries
- Frontend opens SSE on mount, fetches initial via `GET /api/v1/reminder`
- On disconnect: browser EventSource retries with backoff

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

Filter window is managed via local state + localStorage, not URL params.
