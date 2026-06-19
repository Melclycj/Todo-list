<!-- refreshed: 2026-06-19 -->
# Architecture

**Analysis Date:** 2026-06-19

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     React 19 SPA  (browser)                          │
│  features/{auth,tasks,topics,archive,recurring,reminder}             │
│  hooks/use*.ts  ──► api/*.ts  ──► axios client  (in-memory token)   │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ HTTPS  Bearer JWT / HttpOnly cookie
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  FastAPI  backend/app/main.py                         │
│  Middleware stack:                                                    │
│    GZip ─► AccessLog ─► RequestID ─► CORS                           │
│  Routers: /api/v1/{auth,tasks,topics,archive,recurring,             │
│                    reminder,subtasks}                                 │
└──────────┬────────────────────────────────────────────────────────── ┘
           │  FastAPI Depends()
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Services  (business logic)                                          │
│  auth_service  task_service  topic_service  archive_service          │
│  reminder_service  recurring_service  subtask_service                │
└──────────┬───────────────────────────────────────────────────────────┘
           │  UnitOfWork (wraps session, owns commit())
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Repositories  (pure SQL, no business logic)                         │
│  task_repository  topic_repository  recurring_repository             │
│  subtask_repository  user_repository                                 │
└──────────┬───────────────────────────────────────────────────────────┘
           │  SQLAlchemy async ORM
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16   (asyncpg driver)                                    │
└──────────────────────────────────────────────────────────────────────┘

Side channels:
  APScheduler (4am, 6pm, 1am)  ──► TaskService / RecurringService
  SSEConnectionManager (singleton) ◄── TaskService.update_task_status()
                                   ──► GET /api/v1/reminder/stream (client)
```

## Component Responsibilities

| Component | Responsibility | Key File(s) |
|-----------|----------------|-------------|
| FastAPI app factory | Mount routers, middleware, exception handlers, lifespan | `backend/app/main.py` |
| Routers | Parse HTTP request; call service; return `ApiResponse<T>` envelope | `backend/app/routers/*.py` |
| Services | All business rules, ownership checks, status-machine enforcement | `backend/app/services/*.py` |
| UnitOfWork | Transaction boundary; owns `commit()` and `rollback()` | `backend/app/unit_of_work.py` |
| Repositories | SQLAlchemy queries, no business logic | `backend/app/repositories/*.py` |
| Models | SQLAlchemy ORM table mappings | `backend/app/models/*.py` |
| Schemas | Pydantic request/response models; input validation | `backend/app/schemas/*.py` |
| auth/ | JWT encode/decode + FastAPI `Depends` guard | `backend/app/auth/jwt.py`, `backend/app/auth/dependencies.py` |
| middleware/ | RequestID, AccessLog, ErrorHandler (not CORS — that's inline in main.py) | `backend/app/middleware/*.py` |
| scheduler/ | APScheduler wired in lifespan; 3 cron jobs | `backend/app/scheduler/jobs.py` |
| sse/ | In-process `SSEConnectionManager` singleton with per-user asyncio queues | `backend/app/sse/connection_manager.py` |
| Frontend `api/` | Thin axios wrappers; one file per resource | `frontend/src/api/*.ts` |
| Frontend `hooks/` | TanStack Query `useQuery` / `useMutation` wrappers per resource | `frontend/src/hooks/use*.ts` |
| Frontend `features/` | Page components and their child UI components | `frontend/src/features/*/` |

## Pattern Overview

**Overall:** Classic layered architecture (Router → Service → Repository → Model) on the backend. Thin client on the frontend — components call hooks, hooks call `api/`, no business logic in the browser.

**Key Characteristics:**
- Strict layer separation: routers never touch repositories; services never touch the HTTP layer
- `UnitOfWork` centralises transaction management — every service receives a `UnitOfWork` via FastAPI `Depends`, never a bare session
- Repository pattern: each repository is a plain class (`__init__(session)`), no ORM query logic in services
- Pydantic schemas do first-pass validation at the HTTP boundary; deeper business rules live in services
- Frontend state is entirely server-sourced via TanStack Query — no client-side store, no Redux

## Layers

**Router Layer:**
- Purpose: HTTP boundary only — parse request, call one service method, serialize response
- Location: `backend/app/routers/`
- Contains: `APIRouter` objects, `Depends` injection setup, schema usage
- Depends on: Service layer, auth dependencies, schemas
- Used by: FastAPI app (`main.py` `include_router`)
- Rule: No business logic, no direct DB queries

**Service Layer:**
- Purpose: All business logic — ownership checks, status machine validation, side effects (SSE notify, logging)
- Location: `backend/app/services/`
- Contains: `TaskService`, `AuthService`, `RecurringService`, `ReminderService`, `ArchiveService`, `SubtaskService`, `TopicService`
- Depends on: `UnitOfWork` (injected), `SSEConnectionManager` (injected for task/reminder)
- Used by: Routers, APScheduler jobs
- Rule: Never import from routers or schemas

**UnitOfWork:**
- Purpose: Wraps an `AsyncSession`; exposes typed repository attributes; is the sole place `session.commit()` is called
- Location: `backend/app/unit_of_work.py`
- Pattern: `uow.tasks`, `uow.topics`, `uow.users`, `uow.tokens`, `uow.templates`, `uow.subtasks`

**Repository Layer:**
- Purpose: Pure SQL/ORM queries, zero business logic
- Location: `backend/app/repositories/`
- Contains: `TaskRepository`, `TopicRepository`, `RecurringRepository`, `SubtaskRepository`, `UserRepository`, `RefreshTokenRepository`
- Depends on: `AsyncSession`, SQLAlchemy models
- Used by: `UnitOfWork` only

**Model Layer:**
- Purpose: SQLAlchemy ORM table definitions; no methods beyond simple `@property` helpers
- Location: `backend/app/models/`
- Files: `task.py` (Task, TaskStatus enum, task_topics join table), `topic.py`, `user.py` (User, RefreshToken), `recurring.py` (RecurringTemplate, RecurringInstance, RecurringFrequency enum), `subtask.py`

**Schema Layer:**
- Purpose: Pydantic request/response models; input validation at HTTP boundary
- Location: `backend/app/schemas/`
- Files: `common.py` (`ApiResponse[T]`, `PaginationMeta`), `task.py`, `topic.py`, `user.py`, `recurring.py`, `subtask.py`

**Frontend API Layer:**
- Purpose: Thin axios wrappers; each function maps 1:1 to one backend endpoint
- Location: `frontend/src/api/`
- Files: `client.ts` (axios instance, token interceptor, refresh logic), `tasks.ts`, `topics.ts`, `auth.ts`, `archive.ts`, `recurring.ts`, `reminder.ts`, `subtasks.ts`

**Frontend Hooks Layer:**
- Purpose: TanStack Query `useQuery`/`useMutation` wrappers; cache invalidation on mutation success
- Location: `frontend/src/hooks/`
- Files: `useTasks.ts`, `useTopics.ts`, `useAuth.ts`, `useArchive.ts`, `useRecurring.ts`, `useReminder.ts`, `useSubtasks.ts`, plus UI-only hooks (`useDebounce.ts`, `useSidebar.ts`, `useSidebarResize.ts`, `useColumnResize.ts`, `useRecurringColumnResize.ts`)

**Frontend Features Layer:**
- Purpose: Page components and their co-located child components; no API calls — all data via hooks
- Location: `frontend/src/features/`
- Subdirectories: `auth/`, `tasks/`, `topics/`, `archive/`, `recurring/`, `reminder/`

## Data Flow

### Primary Request Path (Task Creation)

1. `POST /api/v1/tasks` arrives — middleware stack runs (RequestID → AccessLog → CORS) (`backend/app/main.py:76-86`)
2. `get_current_user_id` dependency decodes Bearer JWT, stores `user_id` on `request.state` (`backend/app/auth/dependencies.py:16-37`)
3. `get_uow` dependency creates `UnitOfWork(session)` from `async_session_factory` (`backend/app/database.py:39-41`)
4. `_get_task_service` factory injects `TaskService(uow, sse_manager)` (`backend/app/routers/tasks.py:28-29`)
5. Router calls `service.create_task(user_id, ...)` (`backend/app/routers/tasks.py:64-68`)
6. Service validates inputs, calls `uow.tasks.create(...)` then `uow.commit()` (`backend/app/services/task_service.py:100-126`)
7. `TaskRepository.create` inserts row, links topics, returns hydrated `Task` ORM object (`backend/app/repositories/task_repository.py:37-71`)
8. Router wraps ORM object in `TaskResponse.model_validate(task)` and returns `ApiResponse.ok(...)` (`backend/app/routers/tasks.py:69`)

### SSE Reminder Update Flow

1. Client opens `GET /api/v1/reminder/stream` — SSE connection registered in `sse_manager` (`backend/app/routers/reminder.py:57`)
2. `event_generator()` yields initial message then blocks on `asyncio.Queue.get()` with 30s keep-alive timeout (`backend/app/routers/reminder.py:59-83`)
3. When `PATCH /api/v1/tasks/{id}/status` completes, `TaskService.update_task_status` calls `sse_manager.notify_user(user_id)` (`backend/app/services/task_service.py:234-235`)
4. `SSEConnectionManager.notify_user` puts `"update"` onto all queues for that user (`backend/app/sse/connection_manager.py:34-43`)
5. `event_generator` unblocks, recomputes reminder message via `ReminderService.get_reminder_message`, yields `data: <message>\n\n`
6. Frontend `useReminder` hook's `EventSource.onmessage` receives the event and updates React state (`frontend/src/hooks/useReminder.ts:38-47`)

### Scheduler Jobs (4am daily)

1. APScheduler fires `_archive_and_spawn` at 4am (`backend/app/scheduler/jobs.py:72-77`)
2. Job creates its own `UnitOfWork` from `async_session_factory` (isolated session, not a request session)
3. `TaskService.archive_done_tasks(today_4am)` fetches all unarchived Done tasks and bulk-archives those done before boundary
4. `RecurringService.create_due_instances(now)` spawns task instances for all templates where `next_run_at <= now`, advances `next_run_at`
5. Each template's catch-up loop commits independently to avoid one failed template blocking others
6. Separate 6pm and 1am jobs call `sse_manager.broadcast("update")` to push reminder refreshes to all connected clients

### Frontend Auth Flow (page refresh)

1. `main.tsx` renders `<App>` → `<RequireAuth>` reads in-memory `accessToken` (`frontend/src/api/client.ts:3`)
2. Token absent (page refresh cleared memory) → `RequireAuth` calls `refreshToken()` via `POST /api/v1/auth/refresh` sending HttpOnly `refresh_token` cookie (`frontend/src/features/auth/RequireAuth.tsx:19-28`)
3. Success → `setAccessToken(newToken)` stores in module-level variable; axios interceptor attaches it to all future requests (`frontend/src/api/client.ts:5-6`, `18-23`)
4. 401 response on any request → axios response interceptor attempts silent refresh, queues in-flight requests, retries once (`frontend/src/api/client.ts:39-79`)

**State Management:**
- No client-side store. All server state lives in TanStack Query cache (`frontend/src/App.tsx:23-31`). UI-only state (filter window, view mode) is local React `useState`, persisted to `localStorage` (`frontend/src/features/tasks/TaskListPage.tsx:39-40`). In-memory access token is a module-level variable in `frontend/src/api/client.ts`, not React state.

## Key Abstractions

**ApiResponse[T] envelope:**
- Purpose: Uniform `{success, data, error, meta}` shape for every API response
- Backend: `backend/app/schemas/common.py` (Pydantic generic); all routers call `ApiResponse.ok(...)` or `ApiResponse.fail(...)`
- Frontend: `frontend/src/types/api.ts` (TypeScript interface) mirrors the backend schema exactly

**UnitOfWork:**
- Purpose: Transaction boundary; one `UnitOfWork` per request; services call `uow.commit()` once per logical operation
- File: `backend/app/unit_of_work.py`
- Pattern: DI-injected via `get_uow` dependency; never constructed by services themselves

**SSEConnectionManager:**
- Purpose: In-process pub/sub for reminder updates; per-user asyncio queue registry
- File: `backend/app/sse/connection_manager.py`
- Pattern: Module-level singleton `sse_manager` imported by both `main.py` (lifespan) and `task_service.py` / `reminder.py` router

**AppError:**
- Purpose: Safe user-facing business rule errors; subclasses `ValueError` for backward compat; only `AppError.message` is exposed to clients via `app_error_handler → 400`
- File: `backend/app/exceptions.py`

**TaskStatus state machine:**
- Valid transitions defined as dict in service layer (`backend/app/services/task_service.py:19-23`): TODO→{IN_PROGRESS, DONE}, IN_PROGRESS→{DONE}, DONE→{TODO} (reopen)
- `validate_status_transition()` is a pure function — no I/O, fully unit-testable

**RecurringTemplate + RecurringInstance join:**
- Templates track `next_run_at` and `is_active`; instances are Tasks linked via `recurring_instances` join table
- Spawned tasks carry `recurring_template_id` as a read-only `@property` on `Task` — clients can detect recurring origin without extra API calls

## Entry Points

**Backend:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app`
- Responsibilities: creates FastAPI app, registers middleware (GZip, AccessLog, RequestID, CORS), registers all 7 routers under `/api/v1`, registers 4 exception handlers, defines lifespan (APScheduler start/stop)

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite dev server (`npm run dev`) or static bundle served by Caddy
- Responsibilities: creates React root, initialises Sentry if `VITE_SENTRY_DSN` set, mounts `<App>`

**Frontend app shell:**
- Location: `frontend/src/App.tsx`
- Responsibilities: instantiates `QueryClient`, defines route tree with `BrowserRouter`, lazy-loads non-critical pages (TopicListPage, RecurringPage, ArchivePage), provides `<Toaster>`

## Architectural Constraints

- **Async throughout**: Backend uses `asyncpg` + SQLAlchemy async engine; all DB calls are `await`; scheduler jobs use `AsyncIOScheduler`; SSE uses `asyncio.Queue`. No sync DB calls anywhere.
- **Global state**: `sse_manager` is a module-level singleton in `backend/app/sse/connection_manager.py` (shared across all requests in one process). `settings` is a module-level `Settings()` instance in `backend/app/config.py`. Frontend `accessToken` is a module-level `let` in `frontend/src/api/client.ts`.
- **Circular import guard**: `main.py` imports routers lazily after `configure_logging()` and Sentry init to avoid circular imports at module level (comment on line 43). `database.py` imports `UnitOfWork` lazily inside `get_uow` for the same reason.
- **No layer skipping**: Routers never import from `repositories/`; services never import from `routers/` or `schemas/`. Enforced by convention, not by module boundaries.
- **Single-process SSE**: `SSEConnectionManager` uses in-process asyncio queues, so SSE only works with a single-worker deployment. Horizontal scaling would require a Redis pub/sub replacement.

## Anti-Patterns

### Importing `reminder_service.get_day_window` from a repository

**What happens:** `backend/app/repositories/task_repository.py` line 17 imports `get_day_window` from `backend/app/services/reminder_service.py`.
**Why it's wrong:** This is a service → repository import going in reverse (repository should not depend on service layer). `get_day_window` is actually a pure date-math helper that could live in a shared `utils` module.
**Do this instead:** Move `get_day_window` to a shared utility module (e.g., `backend/app/utils/datetime_helpers.py`) and import it from both `reminder_service.py` and `task_repository.py`.

### `PasswordHasher` defined inline in the router

**What happens:** `backend/app/routers/auth.py` defines `class PasswordHasher` inside `_get_auth_service()`.
**Why it's wrong:** A class definition inside a factory function is recreated on every DI resolution and is not easily testable or mockable.
**Do this instead:** Define `PasswordHasher` at module level in `backend/app/auth/` (e.g., `backend/app/auth/password.py`) and import it in both the router and tests.

## Error Handling

**Strategy:** Exceptions propagate up from services; four named exception handlers in `main.py` convert them to the `ApiResponse` envelope.

**Patterns:**
- `LookupError` ("not found") → 404 via `not_found_handler` (`backend/app/middleware/error_handler.py:40-44`)
- `PermissionError` (ownership check failed) → 403 via `permission_error_handler`
- `AppError` (intentional business rule violation) → 400 via `app_error_handler`; only `AppError` messages are exposed to clients
- All other exceptions → 500 via `global_exception_handler`; logs full traceback, returns generic message (no stack trace to client)

## Cross-Cutting Concerns

**Logging:** Structured JSON via `python-json-logger`; configured once in `backend/app/logging_config.py:configure_logging()`. One JSON line per request via `AccessLogMiddleware`. Services emit named events (e.g., `"task.created"`, `"user.login_failed"`) with structured `extra={}` dicts. No PII or tokens in logs.

**Validation:** Two-layer: Pydantic schemas validate at HTTP boundary (type coercion, field constraints, custom `@field_validator`); services re-validate business rules (title length, status transitions, ownership). The two layers overlap intentionally — schemas catch malformed input before it reaches service code.

**Authentication:** JWT Bearer tokens (HS256, `python-jose`). Short-lived access tokens (15 min, in-memory on client). Long-lived refresh tokens (7 days) stored as SHA-256 hash in DB, transmitted as HttpOnly `Secure` `SameSite=Lax` cookie. Token refresh is transparent to the user via axios interceptor.

**Rate limiting:** `slowapi` (Redis-less, IP-keyed) applied to `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`. Limits are configurable via env vars (`register_rate_limit`, `login_rate_limit`, `refresh_rate_limit`).

---

*Architecture analysis: 2026-06-19*
