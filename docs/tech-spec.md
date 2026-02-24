# Todo List App — Technical Specification

> **Status:** Draft — v0.2
> **Last Updated:** 2026-02-24
> **References:** requirements.md

---

## 1. Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | React 19 + TypeScript | Component-based UI, strong ecosystem |
| Build tool | Vite | Fast HMR, modern ESM-based builds |
| UI components | shadcn/ui + Tailwind CSS | Accessible unstyled components, full design control |
| Server state | TanStack Query (React Query) | Handles caching, refetching, and async server state — no Redux needed |
| Frontend routing | React Router v7 | SPA navigation |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable | React 19-compatible; replaces deprecated react-beautiful-dnd |
| Backend | FastAPI (Python 3.12) | Async-native, auto-generated OpenAPI docs, high performance |
| ORM | SQLAlchemy 2.0 (async) | Mature, async-capable, pairs with Alembic |
| DB driver | asyncpg | Async PostgreSQL driver, required by SQLAlchemy async |
| Database | PostgreSQL 16 | Robust concurrency, production-grade, ACID compliant |
| Migrations | Alembic | Schema version control for SQLAlchemy |
| Authentication | JWT (python-jose) + bcrypt | Stateless auth, standard for REST APIs |
| Scheduler | APScheduler | In-process async job scheduler for 4am archiving and recurring task generation |
| Containerisation | Docker + Docker Compose | Portable, reproducible environment |
| Reverse proxy | Nginx | Serves frontend build, proxies API requests |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│   ┌────────────────────────────────────────────────┐    │
│   │           React SPA (thin client)              │    │
│   │  - Render only                                 │    │
│   │  - Call API for all data + logic               │    │
│   │  - TanStack Query manages server state cache   │    │
│   └─────────────────┬──────────────────────────────┘    │
└─────────────────────│───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│                     Nginx                               │
│  - Serves /         → React build (static files)        │
│  - Proxies /api/*   → FastAPI                           │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│                   FastAPI (Uvicorn)                     │
│                                                         │
│   Router → Service → Repository → Database              │
│                                                         │
│   - All business logic lives in Services                │
│   - Routers handle HTTP only                            │
│   - Repositories handle DB queries only                 │
│   - APScheduler runs background jobs (4am tasks)        │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│                   PostgreSQL 16                         │
│   - Connection pool managed by SQLAlchemy               │
│   - All data persisted here                             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Principles

### 3.1 Thin Client (Critical Rule)

The frontend is a rendering layer only. It must not contain business logic.

| Responsibility | Frontend | Backend |
|----------------|----------|---------|
| Render data | ✅ | ❌ |
| User interaction / navigation | ✅ | ❌ |
| Call API endpoints | ✅ | ❌ |
| Filter / sort / order tasks | ❌ | ✅ |
| Compute reminder message | ❌ | ✅ |
| Archive tasks at 4am | ❌ | ✅ |
| Generate recurring instances | ❌ | ✅ |
| Validate business rules | ❌ | ✅ |
| Input schema validation | Lightweight (UX only) | ✅ (authoritative) |

**Rationale:** If the React frontend is replaced by a mobile app or desktop app in the future, the backend requires zero changes. All logic is already in the API.

### 3.2 Layered Backend Architecture

```
HTTP Request
    ↓
Router       — Parses request, validates schema, calls service, returns response
    ↓
Service      — All business logic lives here; orchestrates repositories
    ↓
Repository   — Database queries only; no business logic
    ↓
Model        — SQLAlchemy ORM definitions
```

No layer may be skipped. Routers must not query the database directly. Repositories must not contain business rules.

### 3.3 API-First

All features are implemented as API endpoints first. The frontend is built on top of the API. This also means the API is independently usable (e.g. for future mobile clients).

### 3.4 Immutability

Prefer creating new records over mutating existing ones where state history is relevant (e.g. task status transitions). Use `updated_at` timestamps to track changes.

---

## 4. Backend Specification

### 4.1 Project Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app init, middleware, router registration
│   ├── config.py             # Settings via pydantic-settings (reads .env)
│   ├── database.py           # Async SQLAlchemy engine, session factory
│   ├── models/               # SQLAlchemy ORM models (one file per domain)
│   │   ├── user.py
│   │   ├── task.py
│   │   ├── topic.py
│   │   └── recurring.py
│   ├── schemas/              # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── task.py
│   │   ├── topic.py
│   │   └── recurring.py
│   ├── routers/              # FastAPI routers (HTTP layer only)
│   │   ├── auth.py
│   │   ├── tasks.py
│   │   ├── topics.py
│   │   ├── archive.py
│   │   ├── recurring.py
│   │   └── reminder.py
│   ├── services/             # Business logic (one file per domain)
│   │   ├── auth_service.py
│   │   ├── task_service.py
│   │   ├── topic_service.py
│   │   ├── archive_service.py
│   │   ├── recurring_service.py
│   │   └── reminder_service.py
│   ├── repositories/         # DB queries (one file per model)
│   │   ├── task_repository.py
│   │   ├── topic_repository.py
│   │   ├── user_repository.py
│   │   └── recurring_repository.py
│   ├── sse/
│   │   └── connection_manager.py  # Per-user SSE connection registry for reminder push
│   ├── scheduler/
│   │   └── jobs.py           # APScheduler job definitions (4am archive + recurring + 6pm/1am reminder push)
│   ├── auth/
│   │   ├── jwt.py            # Token creation, verification
│   │   └── dependencies.py   # FastAPI dependency: get_current_user
│   └── middleware/
│       └── error_handler.py  # Global exception → standard error response
├── alembic/
│   ├── env.py
│   └── versions/
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile
├── requirements.txt
└── .env.example
```

### 4.2 API Versioning

All endpoints are prefixed with `/api/v1/`. Version bumps (`/api/v2/`) are introduced only on breaking changes.

### 4.3 Standard API Response Format

All responses use this envelope:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

- `meta` is only present on paginated responses.
- On error, `data` is `null` and `error` contains a message string.

### 4.4 API Endpoints Overview

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT access + refresh token |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate refresh token |

#### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tasks` | List active tasks (supports filter params) |
| POST | `/api/v1/tasks` | Create a task |
| GET | `/api/v1/tasks/{id}` | Get single task |
| PATCH | `/api/v1/tasks/{id}` | Update task fields |
| DELETE | `/api/v1/tasks/{id}` | Delete task |
| PATCH | `/api/v1/tasks/{id}/status` | Update task status |
| PATCH | `/api/v1/tasks/{id}/order` | Update manual sort order within same-day group |

**Filter query params for `GET /api/v1/tasks`:**
- `window`: `today` | `3days` | `week` | `all`
- `topic_id`: UUID
- `q`: search query string
- `page`: integer, default `1`
- `limit`: integer, default `20`, max `30`

#### Topics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/topics` | List all topics |
| POST | `/api/v1/topics` | Create topic |
| PATCH | `/api/v1/topics/{id}` | Rename topic |
| DELETE | `/api/v1/topics/{id}` | Delete topic (tasks become untagged) |

#### Archive
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/archive` | List archived tasks (supports `page` and `limit`, max 30 per page) |
| POST | `/api/v1/archive/{id}/restore` | Restore archived task to active |

#### Recurring
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/recurring` | List recurring templates |
| POST | `/api/v1/recurring` | Create recurring template |
| PATCH | `/api/v1/recurring/{id}` | Update template (frequency, title) |
| DELETE | `/api/v1/recurring/{id}` | Stop recurring template permanently |

#### Reminder
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reminder` | Get current reminder message (single fetch, for initial load) |
| GET | `/api/v1/reminder/stream` | SSE stream — server pushes updated reminder on task status change or time boundary crossing (6pm, 1am) |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns server status and DB connectivity check. Used by Docker and load balancers. No auth required. |

### 4.5 Authentication

- JWT access tokens (short-lived: 15 minutes)
- JWT refresh tokens (long-lived: 7 days, stored in HTTP-only cookie)
- Passwords hashed with bcrypt
- All protected endpoints use a `get_current_user` FastAPI dependency
- Refresh tokens are stored in the database (enables logout/revocation)

### 4.6 Concurrency & Database Connection Pooling

FastAPI runs on Uvicorn with async handlers. SQLAlchemy async engine is configured with a connection pool:

```
pool_size=10          # Persistent connections kept alive
max_overflow=20       # Max additional connections under load
pool_timeout=30       # Seconds to wait before connection timeout error
pool_recycle=1800     # Recycle connections every 30 minutes
```

These values are configurable via environment variables.

### 4.7 Scheduled Jobs (APScheduler)

All scheduled times use the server timezone configured via the `SCHEDULER_TIMEZONE` environment variable. The 4am day boundary, 6pm and 1am reminder boundaries, and all task due-date comparisons are evaluated in this timezone. Timestamps are stored in UTC in the database and converted to server timezone for all business logic.

| Job | Schedule | Description |
|-----|----------|-------------|
| `archive_done_tasks` | Daily at 4:00 AM | Finds all tasks with `status = done` and `done_at < today's 4am`. Sets `archived = true`. |
| `create_recurring_instances` | Daily at 4:00 AM | For each active recurring template where `next_run_at <= now`, creates a new task instance (inheriting title, description, and topics from the template) and advances `next_run_at` by the template's frequency. |
| `push_reminder_at_6pm` | Daily at 6:00 PM | Broadcasts an updated reminder message via SSE to all currently connected users. |
| `push_reminder_at_1am` | Daily at 1:00 AM | Broadcasts an updated reminder message via SSE to all currently connected users. |

APScheduler is started as a lifespan event in `main.py` so it runs within the same process as the API.

### 4.8 Error Handling

All unhandled exceptions are caught by global middleware and returned as:

```json
{
  "success": false,
  "data": null,
  "error": "Human-readable error message"
}
```

HTTP status codes follow REST conventions:
- `400` — Validation error (bad input)
- `401` — Not authenticated
- `403` — Not authorised (wrong user)
- `404` — Resource not found
- `409` — Conflict (e.g. duplicate topic name)
- `500` — Internal server error (generic message only; details in server logs)

---

## 5. Frontend Specification

### 5.1 Project Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Router setup
│   ├── api/                  # API client (one file per domain)
│   │   ├── client.ts         # Axios instance + interceptors (auth headers, 401 redirect)
│   │   ├── tasks.ts
│   │   ├── topics.ts
│   │   ├── archive.ts
│   │   ├── recurring.ts
│   │   ├── reminder.ts
│   │   └── auth.ts
│   ├── hooks/                # TanStack Query hooks wrapping api/ calls
│   │   ├── useTasks.ts
│   │   ├── useTopics.ts
│   │   ├── useReminder.ts
│   │   └── useAuth.ts
│   ├── features/             # Domain-scoped components and pages
│   │   ├── tasks/
│   │   ├── topics/
│   │   ├── archive/
│   │   ├── recurring/
│   │   └── auth/
│   ├── components/           # Shared UI components (wrapping shadcn/ui)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainContent.tsx
│   │   └── ui/               # shadcn/ui component re-exports
│   ├── lib/
│   │   └── utils.ts          # shadcn/ui utility (cn helper)
│   └── types/                # Shared TypeScript types mirroring API schemas
├── public/
├── index.html
├── Dockerfile
├── nginx.conf
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 5.2 State Management

There is no global client-side state store (no Redux, no Zustand).

| State type | Managed by |
|------------|------------|
| Server data (tasks, topics, archive) | TanStack Query |
| Current filter / active sidebar section | React Router (URL params / path) |
| UI state (modal open, form input) | Local `useState` in component |
| Auth token | HTTP-only cookie (refresh) + memory (access) |

Server state is the only state that matters. TanStack Query handles caching, background refetching, and invalidation after mutations. This keeps the frontend stateless with respect to business data.

### 5.3 API Communication Rules

- All API calls go through `src/api/client.ts` (Axios instance).
- Axios interceptors attach the access token to every request.
- On `401` response, interceptor attempts a silent token refresh before retrying once.
- On failed refresh, user is redirected to login.
- No component may call `fetch` or `axios` directly — all calls must go through the `src/api/` layer.

### 5.4 Reminder (SSE Observer)

The reminder banner (FR-07) uses Server-Sent Events (SSE) via `GET /api/v1/reminder/stream`. No polling — the server pushes updates to the client.

**When the backend pushes an update:**
- Any task status change: `task_service` notifies the SSE `connection_manager` after writing to the DB, which pushes the new reminder message to all active SSE connections for that user.
- Time boundary crossings (6pm, 1am): APScheduler jobs broadcast to all connected users.

**Frontend behaviour:**
- On mount, the reminder component opens an SSE connection and fetches the initial message via `GET /api/v1/reminder`.
- Each SSE event replaces the displayed message in local state.
- On connection drop, the client retries with exponential backoff (built into the browser `EventSource` API).
- The backend computes the correct message based on server time. The frontend renders only.

`refetchInterval` (TanStack Query polling) is **not** used for the reminder.

### 5.5 Routing

| Path | View |
|------|------|
| `/login` | Login page |
| `/register` | Register page |
| `/` | Active tasks — All Tasks filter |
| `/?window=today` | Active tasks — Today filter |
| `/?window=3days` | Active tasks — Within 3 Days filter |
| `/?window=week` | Active tasks — Within a Week filter |
| `/topics/:id` | Tasks filtered by topic |
| `/recurring` | Recurring templates view |
| `/archive` | Archive view |

---

## 6. Database Schema

### 6.1 Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| hashed_password | VARCHAR | bcrypt hash |
| created_at | TIMESTAMPTZ | |

#### `topics`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR(100) | Unique per user |
| created_at | TIMESTAMPTZ | |

#### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | VARCHAR(255) | |
| description | TEXT | Nullable |
| due_date | TIMESTAMPTZ | Nullable |
| status | ENUM | `todo`, `in_progress`, `done` |
| result_note | TEXT | Nullable |
| archived | BOOLEAN | Default false |
| done_at | TIMESTAMPTZ | Set when status → done |
| archived_at | TIMESTAMPTZ | Set by scheduler job |
| manual_order | INTEGER | For same-day drag sort; nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `task_topics` (join table)
| Column | Type | Notes |
|--------|------|-------|
| task_id | UUID FK → tasks | |
| topic_id | UUID FK → topics | |
| PRIMARY KEY | (task_id, topic_id) | |

#### `recurring_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | VARCHAR(255) | |
| description | TEXT | Nullable |
| frequency | ENUM | `weekly`, `fortnightly`, `monthly` |
| is_active | BOOLEAN | False = stopped permanently |
| next_run_at | TIMESTAMPTZ | When next instance should be created |
| created_at | TIMESTAMPTZ | |

#### `recurring_template_topics` (join table)
| Column | Type | Notes |
|--------|------|-------|
| template_id | UUID FK → recurring_templates | |
| topic_id | UUID FK → topics | |
| PRIMARY KEY | (template_id, topic_id) | |

> When a recurring instance is created, the scheduler copies all rows from `recurring_template_topics` into `task_topics` for the new task. Topic changes on the template apply to future instances only.

#### `recurring_instances`
| Column | Type | Notes |
|--------|------|-------|
| template_id | UUID FK → recurring_templates | |
| task_id | UUID FK → tasks | |
| PRIMARY KEY | (template_id, task_id) | |

#### `refresh_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| token_hash | VARCHAR(64) | SHA-256 hex digest of the raw refresh token |
| expires_at | TIMESTAMPTZ | |
| revoked | BOOLEAN | Default false |

### 6.2 Key Indexes

```sql
CREATE INDEX idx_tasks_user_status      ON tasks(user_id, status, archived);
CREATE INDEX idx_tasks_due_date         ON tasks(due_date);
CREATE INDEX idx_tasks_done_at          ON tasks(done_at) WHERE status = 'done';
CREATE INDEX idx_task_topics_topic      ON task_topics(topic_id);
CREATE INDEX idx_recurring_next_run          ON recurring_templates(next_run_at) WHERE is_active = true;
CREATE INDEX idx_recurring_template_topics   ON recurring_template_topics(topic_id);
```

---

## 7. Deployment

### 7.1 Docker Compose Services

```
services:
  db        — PostgreSQL 16
  api       — FastAPI (Uvicorn)
  frontend  — Nginx serving React build + reverse proxy to api
```

### 7.2 Nginx Configuration

- `GET /` and all non-API paths → serve `index.html` (React SPA)
- `GET /api/*` → proxy to `http://api:8000`
- HTTPS termination at Nginx (Let's Encrypt / provided cert)

### 7.3 Environment Variables

Backend (`.env`):
```
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/todoapp
SECRET_KEY=<long random string>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
SCHEDULER_TIMEZONE=UTC
```

Frontend (build-time):
```
VITE_API_BASE_URL=/api/v1
```

---

## 8. Testing Strategy

### Backend
| Type | Tool | Target coverage |
|------|------|----------------|
| Unit | pytest + pytest-asyncio | Services layer ≥ 80% |
| Integration | pytest + httpx (TestClient) | All API endpoints |
| DB | pytest with test database | Repository layer |

### Frontend
| Type | Tool | Target coverage |
|------|------|----------------|
| Unit | Vitest + React Testing Library | Hooks and utility functions |
| Component | Vitest + React Testing Library | Key feature components |
| E2E | Playwright | Critical user flows |

---

## 9. Open Decisions

| ID | Decision | Status |
|----|----------|--------|
| OD-01 | Plain text for task description | **Resolved.** `description` column is `TEXT`. No rich text editor required. |
| OD-02 | Server timezone for all time logic | **Resolved.** All time boundaries (4am, 6pm, 1am) use server timezone set via `SCHEDULER_TIMEZONE`. Timestamps stored in UTC; converted to server timezone in business logic. No per-user timezone. |
| OD-03 | PWA support | Open. Add service worker + manifest for installability? (recommended for mobile/desktop install) |

---

## 10. CI/CD Pipeline

### 10.1 Platform

GitHub Actions. Two workflows, both in `.github/workflows/`.

### 10.2 Workflow: `ci.yml` (Pull Request gate)

Triggers: all pushes to any branch and all pull requests targeting `main`.

```
Steps:
1. Checkout
2. [Backend]
   a. Install Python dependencies (pip install -r requirements.txt)
   b. Run pytest with coverage (fail if < 80%)
3. [Frontend]
   a. Install Node dependencies (npm ci)
   b. Run vitest with coverage (fail if < 80%)
   c. Run TypeScript type check (tsc --noEmit)
4. Docker build check
   a. docker compose build (validates Dockerfiles build cleanly)
```

PRs cannot be merged if this workflow fails.

### 10.3 Workflow: `deploy.yml` (Production deploy)

Triggers: push or merge to `main` only.

```
Steps:
1. Checkout
2. SSH into VPS
3. git pull origin main
4. docker compose up -d --build
5. docker compose exec api alembic upgrade head
6. Health check: curl /api/health — fail deploy if not 200
```

Secrets stored in GitHub repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

### 10.4 Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production. Protected — no direct pushes. |
| `feature/*` | Feature branches. Merge to `main` via PR after CI passes. |
