# Codebase Structure

**Analysis Date:** 2026-06-19

## Directory Layout

```
Todo-list/                          # Project root
├── backend/                        # FastAPI Python backend
│   ├── app/                        # Application package
│   │   ├── main.py                 # FastAPI app factory + lifespan (entry point)
│   │   ├── config.py               # Pydantic Settings (env vars)
│   │   ├── database.py             # SQLAlchemy engine, session factory, get_db, get_uow
│   │   ├── unit_of_work.py         # Transaction boundary, exposes typed repositories
│   │   ├── exceptions.py           # AppError hierarchy
│   │   ├── limiter.py              # slowapi rate limiter instance
│   │   ├── logging_config.py       # Structured JSON logging setup
│   │   ├── auth/                   # JWT utilities + FastAPI dependency
│   │   │   ├── jwt.py              # create_access_token / decode_access_token
│   │   │   └── dependencies.py     # get_current_user_id (FastAPI Depends)
│   │   ├── middleware/             # Starlette middleware classes
│   │   │   ├── access_log.py       # Per-request structured log line
│   │   │   ├── error_handler.py    # 4 exception handlers (404/403/400/500)
│   │   │   └── request_id.py       # Attach/echo X-Request-ID
│   │   ├── routers/                # HTTP layer: parse → call service → return ApiResponse
│   │   │   ├── auth.py             # /api/v1/auth/{register,login,refresh,logout}
│   │   │   ├── tasks.py            # /api/v1/tasks/*
│   │   │   ├── topics.py           # /api/v1/topics/*
│   │   │   ├── archive.py          # /api/v1/archive/*
│   │   │   ├── recurring.py        # /api/v1/recurring/*
│   │   │   ├── reminder.py         # /api/v1/reminder + /api/v1/reminder/stream (SSE)
│   │   │   └── subtasks.py         # /api/v1/tasks/{id}/subtasks/*
│   │   ├── services/               # Business logic (all rules live here)
│   │   │   ├── auth_service.py
│   │   │   ├── task_service.py
│   │   │   ├── topic_service.py
│   │   │   ├── archive_service.py
│   │   │   ├── recurring_service.py
│   │   │   ├── reminder_service.py
│   │   │   └── subtask_service.py
│   │   ├── repositories/           # SQLAlchemy queries, no business logic
│   │   │   ├── task_repository.py
│   │   │   ├── topic_repository.py
│   │   │   ├── recurring_repository.py
│   │   │   ├── subtask_repository.py
│   │   │   └── user_repository.py  # UserRepository + RefreshTokenRepository
│   │   ├── models/                 # SQLAlchemy ORM table definitions
│   │   │   ├── task.py             # Task, TaskStatus enum, task_topics join table
│   │   │   ├── topic.py            # Topic
│   │   │   ├── user.py             # User, RefreshToken
│   │   │   ├── recurring.py        # RecurringTemplate, RecurringInstance, join table
│   │   │   └── subtask.py          # Subtask
│   │   ├── schemas/                # Pydantic request/response models
│   │   │   ├── common.py           # ApiResponse[T], PaginationMeta
│   │   │   ├── task.py
│   │   │   ├── topic.py
│   │   │   ├── user.py             # UserRegisterRequest, TokenResponse, etc.
│   │   │   ├── recurring.py
│   │   │   └── subtask.py
│   │   ├── scheduler/              # APScheduler job definitions
│   │   │   └── jobs.py             # create_scheduler(); 3 cron jobs
│   │   └── sse/                    # SSE connection management
│   │       └── connection_manager.py   # SSEConnectionManager singleton
│   ├── alembic/                    # DB migrations
│   │   ├── alembic.ini             # (root level)
│   │   └── versions/               # 4 migration files (001–004)
│   ├── tests/
│   │   ├── unit/                   # Pure unit tests (no DB)
│   │   └── integration/            # Tests requiring DB (test_database_url)
│   └── requirements.txt            # Python dependencies
├── frontend/                       # React 19 SPA
│   ├── src/
│   │   ├── main.tsx                # React root, Sentry init (entry point)
│   │   ├── App.tsx                 # QueryClient, BrowserRouter, route tree
│   │   ├── api/                    # Thin axios wrappers (1 file per resource)
│   │   │   ├── client.ts           # Axios instance, token interceptor, refresh logic
│   │   │   ├── tasks.ts
│   │   │   ├── topics.ts
│   │   │   ├── auth.ts
│   │   │   ├── archive.ts
│   │   │   ├── recurring.ts
│   │   │   ├── reminder.ts         # getReminder() + createReminderStream() (EventSource)
│   │   │   └── subtasks.ts
│   │   ├── hooks/                  # TanStack Query wrappers + UI hooks
│   │   │   ├── useTasks.ts
│   │   │   ├── useTopics.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── useArchive.ts
│   │   │   ├── useRecurring.ts
│   │   │   ├── useReminder.ts      # EventSource connect/retry/poll-fallback
│   │   │   ├── useSubtasks.ts
│   │   │   ├── useDebounce.ts
│   │   │   ├── useSidebar.ts
│   │   │   ├── useSidebarResize.ts
│   │   │   ├── useColumnResize.ts
│   │   │   └── useRecurringColumnResize.ts
│   │   ├── features/               # Pages + co-located child components
│   │   │   ├── auth/               # LoginPage, RegisterPage, RequireAuth, AuthLayout
│   │   │   ├── tasks/              # TaskListPage + 20+ child components
│   │   │   ├── topics/             # TopicListPage (lazy-loaded)
│   │   │   ├── archive/            # ArchivePage (lazy-loaded)
│   │   │   ├── recurring/          # RecurringPage (lazy-loaded)
│   │   │   └── reminder/           # Reminder banner component
│   │   ├── components/
│   │   │   ├── layout/             # AppLayout.tsx, Sidebar.tsx
│   │   │   └── ui/                 # shadcn/ui primitives (button, dialog, etc.)
│   │   ├── types/                  # TypeScript interfaces
│   │   │   ├── api.ts              # ApiResponse<T>, PaginationMeta
│   │   │   ├── task.ts             # Task, Subtask, payloads, TaskFilterParams
│   │   │   ├── topic.ts
│   │   │   ├── auth.ts
│   │   │   └── recurring.ts
│   │   ├── lib/
│   │   │   └── utils.ts            # cn() (clsx + tailwind-merge)
│   │   └── assets/                 # Static assets
│   ├── e2e/                        # Playwright E2E tests
│   ├── public/                     # Static files served by Vite
│   ├── vite.config.ts              # Vite + Vitest config, @/ alias, chunk splitting
│   ├── package.json
│   └── tsconfig.json
├── infra/
│   └── postgres/                   # Docker init SQL (if any)
├── docs/                           # Project documentation (MAY HAVE DRIFTED from code)
│   └── audits/                     # Audit records
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI pipeline
│       └── deploy.yml              # CD pipeline (triggers on merge to main)
├── .planning/                      # GSD planning docs (not committed to main history)
│   └── codebase/                   # Codebase map documents (this directory)
├── docker-compose.yml              # Full-stack local dev
└── CLAUDE.md                       # Project-level AI assistant instructions
```

## Directory Purposes

**`backend/app/routers/`:**
- Purpose: HTTP boundary — one file per resource domain
- Contains: `APIRouter` instances, FastAPI `Depends` wiring, response serialization
- Key files: `tasks.py`, `reminder.py` (includes SSE stream endpoint), `auth.py`
- Rule: No business logic; call exactly one service method per endpoint

**`backend/app/services/`:**
- Purpose: All business rules — the only place ownership checks, status machine transitions, and domain validation happen
- Contains: One service class per resource
- Key files: `task_service.py` (also has pure helper functions `validate_status_transition`, `is_task_archivable`, `build_instance_title`), `recurring_service.py`, `reminder_service.py`

**`backend/app/repositories/`:**
- Purpose: SQLAlchemy queries; no branching business logic
- Contains: One repository class per table group
- Key files: `task_repository.py` (most complex — pagination, filtering, bulk ops), `user_repository.py` (includes `RefreshTokenRepository`)

**`backend/app/models/`:**
- Purpose: SQLAlchemy ORM table mappings; defines relationships and enums
- Key files: `task.py` defines `task_topics` M2M join table; `recurring.py` defines both `RecurringTemplate` and `RecurringInstance`

**`backend/app/schemas/`:**
- Purpose: Pydantic models for HTTP validation and serialization
- Key files: `common.py` (`ApiResponse[T]` generic used by every router)

**`backend/app/auth/`:**
- Purpose: JWT lifecycle and FastAPI dependency guard
- `jwt.py`: `create_access_token` / `decode_access_token` (HS256 via python-jose)
- `dependencies.py`: `get_current_user_id` FastAPI `Depends` used by every authenticated router

**`backend/app/scheduler/`:**
- Purpose: APScheduler job registration; jobs are created via `create_scheduler(session_factory, sse_manager)` called in lifespan
- Three jobs: `archive_and_spawn` (4am), `push_reminder_at_6pm`, `push_reminder_at_1am`

**`backend/app/sse/`:**
- Purpose: In-process SSE pub/sub via asyncio queues
- `connection_manager.py`: Module-level `sse_manager` singleton; `add_connection` / `remove_connection` / `notify_user` / `broadcast`

**`backend/alembic/versions/`:**
- Purpose: Database migration history
- Files: `001_initial_schema.py`, `002_index_refresh_token_hash.py`, `003_recurring_daily_due_date.py`, `004_subtasks.py`

**`frontend/src/api/`:**
- Purpose: Thin HTTP functions; one file per backend resource; import `client` from `client.ts`
- `client.ts` is special: owns the axios instance, in-memory token storage, and the 401-refresh interceptor chain

**`frontend/src/hooks/`:**
- Purpose: TanStack Query integration (`useQuery`/`useMutation`) and UI-only hooks
- Data hooks (use api/ and return React Query state): `useTasks`, `useTopics`, `useAuth`, `useArchive`, `useRecurring`, `useReminder`, `useSubtasks`
- UI hooks (pure React state/refs): `useDebounce`, `useSidebar`, `useSidebarResize`, `useColumnResize`, `useRecurringColumnResize`

**`frontend/src/features/`:**
- Purpose: Feature-scoped pages and all their child components, co-located
- Each feature folder is self-contained: page, sub-components, feature-local types/helpers

**`frontend/src/components/`:**
- `layout/`: `AppLayout.tsx` (sidebar + outlet shell), `Sidebar.tsx` (navigation)
- `ui/`: Headless shadcn/ui primitives (button, dialog, dropdown-menu, input, label, popover, scroll-area, separator, skeleton, textarea, tooltip)

**`frontend/src/types/`:**
- Purpose: TypeScript interfaces mirroring backend Pydantic schemas
- `api.ts` defines `ApiResponse<T>` and `PaginationMeta` — used by all `api/*.ts` functions

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app factory; start here for all backend questions
- `frontend/src/main.tsx`: React entry; mounts `<App>`
- `frontend/src/App.tsx`: Route tree, QueryClient setup

**Configuration:**
- `backend/app/config.py`: All env vars (Pydantic `BaseSettings`); defaults shown; `SECRET_KEY` has no default and is required
- `frontend/vite.config.ts`: Vite config, `@/` alias (maps to `src/`), chunk splitting, Vitest config

**Database:**
- `backend/app/database.py`: Engine, `async_session_factory`, `get_db`, `get_uow` dependencies
- `backend/app/unit_of_work.py`: Transaction boundary; all repository instances

**Auth:**
- `backend/app/auth/jwt.py`: Token creation/verification
- `backend/app/auth/dependencies.py`: `get_current_user_id` guard used on every authenticated endpoint
- `frontend/src/api/client.ts`: Token storage + silent refresh interceptor
- `frontend/src/features/auth/RequireAuth.tsx`: Route guard; silent refresh on page load

**SSE:**
- `backend/app/routers/reminder.py`: SSE endpoint (`GET /reminder/stream`) and polling endpoint (`GET /reminder`)
- `backend/app/sse/connection_manager.py`: Singleton `sse_manager`
- `frontend/src/hooks/useReminder.ts`: EventSource with exponential retry + polling fallback
- `frontend/src/api/reminder.ts`: `createReminderStream()` appends token as query param (EventSource cannot set headers)

**Scheduler:**
- `backend/app/scheduler/jobs.py`: All three cron jobs; `create_scheduler()` called from lifespan in `main.py`

**Error Handling:**
- `backend/app/exceptions.py`: `AppError` (subclass of `ValueError`)
- `backend/app/middleware/error_handler.py`: 4 exception → HTTP status converters

**API Response Envelope:**
- `backend/app/schemas/common.py`: `ApiResponse[T]` Pydantic model
- `frontend/src/types/api.ts`: `ApiResponse<T>` TypeScript interface (must stay in sync)

## Naming Conventions

**Backend Files:**
- Modules: `snake_case.py`
- Router files: noun plural (`tasks.py`, `topics.py`) or noun singular (`auth.py`, `reminder.py`)
- Service files: `<noun>_service.py`
- Repository files: `<noun>_repository.py`
- Model files: noun singular (`task.py`, `user.py`)
- Schema files: noun singular matching model (`task.py`, `user.py`)

**Backend Symbols:**
- Classes: `PascalCase` (`TaskService`, `TaskRepository`, `Task`)
- Functions: `snake_case`
- Enums: `PascalCase` class, `UPPER_CASE` members (`TaskStatus.TODO`)
- Exception types: subclass `AppError` for intentional errors

**Frontend Files:**
- Components: `PascalCase.tsx` (`TaskListPage.tsx`, `AppLayout.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (`useTasks.ts`)
- API modules: `camelCase.ts` matching resource (`tasks.ts`, `auth.ts`)
- Type files: `camelCase.ts` (`task.ts`, `api.ts`)

**Frontend Symbols:**
- Components: `PascalCase` function (`export function TaskListPage()`)
- Hooks: `camelCase` with `use` prefix (`export function useTasks(...)`)
- API functions: `camelCase` verb+noun (`createTask`, `updateTaskStatus`)
- Types/interfaces: `PascalCase` (`Task`, `ApiResponse<T>`, `TaskFilterParams`)
- Query keys: `UPPER_CASE` constants (`TASKS_QUERY_KEY = 'tasks'`)

## Where to Add New Code

**New backend endpoint (new resource, e.g., "labels"):**
1. Model: `backend/app/models/label.py` — SQLAlchemy ORM class extending `Base`
2. Schema: `backend/app/schemas/label.py` — Pydantic request/response models
3. Repository: `backend/app/repositories/label_repository.py` — query methods only
4. Register in UnitOfWork: add `self.labels = LabelRepository(session)` to `backend/app/unit_of_work.py`
5. Service: `backend/app/services/label_service.py` — business logic, uses `uow.labels`
6. Router: `backend/app/routers/labels.py` — APIRouter, call service via Depends
7. Register router: `app.include_router(labels.router, prefix="/api/v1")` in `backend/app/main.py`
8. Migration: new file under `backend/alembic/versions/`

**New endpoint on an existing resource:**
1. Add method to the existing service in `backend/app/services/<resource>_service.py`
2. Add query method to `backend/app/repositories/<resource>_repository.py` if DB access needed
3. Add schema classes to `backend/app/schemas/<resource>.py`
4. Add route handler to `backend/app/routers/<resource>.py`

**New frontend feature:**
1. Add feature folder: `frontend/src/features/<feature>/`
2. Create page: `frontend/src/features/<feature>/<Feature>Page.tsx`
3. Add API functions: `frontend/src/api/<resource>.ts` (if new resource)
4. Add hooks: `frontend/src/hooks/use<Resource>.ts` (TanStack Query wrappers)
5. Add TypeScript types: `frontend/src/types/<resource>.ts`
6. Register route in `frontend/src/App.tsx` (lazy-load with `React.lazy` for less-visited pages)

**New shared UI primitive:**
- Add to `frontend/src/components/ui/<component>.tsx` (follow shadcn/ui patterns)

**New utility function:**
- Pure frontend utility: `frontend/src/lib/utils.ts` or new file in `frontend/src/lib/`
- Pure backend utility (date math, etc.): consider `backend/app/utils/` (directory does not yet exist — create it)

## Special Directories

**`backend/alembic/`:**
- Purpose: Alembic migration history; `env.py` reads `settings.database_url`
- Generated: Yes (by `alembic revision`)
- Committed: Yes — migration files are source-controlled

**`backend/tests/`:**
- Purpose: Pytest test suites
- `unit/`: No DB required; tests pure functions and service logic with mocks
- `integration/`: Requires `TEST_DATABASE_URL`; tests repositories and full request paths

**`frontend/e2e/`:**
- Purpose: Playwright end-to-end tests
- Run via `npm run test:e2e`

**`frontend/src/components/ui/`:**
- Purpose: Headless shadcn/ui component wrappers (Radix UI primitives + Tailwind classes)
- Generated/sourced: Manually copied from shadcn/ui CLI output and checked in
- Do not add application logic here — keep these as pure UI primitives

**`.planning/`:**
- Purpose: GSD planning documents, codebase maps, sprint state
- Generated: Yes (by GSD tooling)
- Committed: Partially (some artefacts committed, some local-only)

**`docs/`:**
- Purpose: Human-readable specification documents
- IMPORTANT: These docs have drifted from the actual code. Trust the code, not docs/, for ground truth.

---

*Structure analysis: 2026-06-19*
