# External Integrations

**Analysis Date:** 2026-06-19

## APIs & External Services

**Error Tracking:**
- Sentry — backend and frontend error tracking
  - Backend SDK: `sentry-sdk[fastapi] 2.29.1` (`backend/requirements.txt`)
  - Frontend SDK: `@sentry/react 10.47.0` (`frontend/package.json`)
  - Backend init: `backend/app/main.py` lines 36-41 — conditionally initializes when `SENTRY_DSN` env var is non-empty
  - Frontend init: `frontend/src/main.tsx` lines 7-12 — conditionally initializes when `VITE_SENTRY_DSN` env var is non-empty
  - Traces sample rate: 0.2 (both backend and frontend)
  - Disabled by default (empty DSN in `.env.example`)

**No other external third-party APIs are integrated.** All features (auth, tasks, reminders, scheduling) are self-contained.

## Data Storage

**Primary Database:**
- PostgreSQL 16
  - Image: `postgres:16-alpine` (`docker-compose.yml` line 2)
  - Connection env var: `DATABASE_URL` (async format: `postgresql+asyncpg://...`)
  - Test database env var: `TEST_DATABASE_URL`
  - Client: SQLAlchemy 2.0.36 async engine + asyncpg 0.30.0 driver (`backend/app/database.py`)
  - Connection pool: `pool_size=10`, `max_overflow=20`, `pool_timeout=30`, `pool_recycle=1800` (all configurable via `config.py`)
  - ORM: SQLAlchemy `DeclarativeBase` with mapped columns (`backend/app/database.py`)
  - Data volume: `postgres_data` named Docker volume (`docker-compose.yml` line 46)
  - Init script: `infra/postgres/init.sql` — creates the test database alongside the main one (mounted read-only in Docker)

**File Storage:**
- Local filesystem only — no S3, GCS, or other object storage detected

**Caching:**
- None — no Redis, Memcached, or in-process cache layer detected
- TanStack React Query handles client-side caching of API responses in the frontend

## Authentication & Identity

**Auth Provider:**
- Custom — no third-party identity provider (no OAuth, no Auth0, no Supabase Auth)

**Implementation:** Two-token JWT pattern with HttpOnly cookie for refresh token:

1. **Registration:** `POST /api/v1/auth/register` → hashes password with bcrypt via passlib → stores `User` row (`backend/app/routers/auth.py`)
2. **Login:** `POST /api/v1/auth/login` → verifies bcrypt hash → issues short-lived JWT access token (15 min default) in response body + long-lived refresh token (7 days default) as `HttpOnly; Secure; SameSite=lax` cookie
3. **Access token:** JWT, HS256 algorithm, signed with `SECRET_KEY`, payload: `{sub: user_id, exp, type: "access"}` (`backend/app/auth/jwt.py`)
4. **Refresh token:** Stored in `refresh_tokens` table as a SHA-256 hash (`token_hash` column, `String(64)`), not the raw token. `revoked` boolean + `expires_at` timestamp (`backend/app/models/user.py`)
5. **Silent refresh:** Frontend axios interceptor in `frontend/src/api/client.ts` — on 401, attempts `POST /api/v1/auth/refresh` using the cookie, queues concurrent requests during refresh, retries once; redirects to `/login` on refresh failure
6. **Route protection:** `get_current_user_id` FastAPI dependency (`backend/app/auth/dependencies.py`) — extracts Bearer token from `Authorization` header, decodes and validates JWT, stores `user_id` on `request.state` for access log middleware
7. **Logout:** `POST /api/v1/auth/logout` — revokes refresh token in DB, deletes the cookie
8. **Password storage:** bcrypt via `passlib.context.CryptContext(schemes=["bcrypt"])` — instantiated inline in `backend/app/routers/auth.py` `_get_auth_service()`

**Rate Limiting on auth endpoints** (slowapi, keyed by remote IP, `backend/app/limiter.py`):
- Register: `100/minute` (configurable via `REGISTER_RATE_LIMIT`)
- Login: `100/minute` (configurable via `LOGIN_RATE_LIMIT`)
- Refresh: `200/minute` (configurable via `REFRESH_RATE_LIMIT`)

## Server-Sent Events (SSE) — Reminder Notifications

**Purpose:** Push real-time reminder message updates to connected browser clients without polling.

**Backend implementation:**
- `backend/app/sse/connection_manager.py` — `SSEConnectionManager` class: per-user registry of `asyncio.Queue` instances; module-level singleton `sse_manager` shared across the application
- `backend/app/routers/reminder.py` — two endpoints:
  - `GET /api/v1/reminder` — single fetch of current reminder message (initial page load)
  - `GET /api/v1/reminder/stream` — persistent SSE stream; sends initial message immediately, then waits on queue with 30-second keep-alive timeout; returns `StreamingResponse` with `text/event-stream` + `X-Accel-Buffering: no` header (required for Nginx reverse proxy)

**Trigger points for SSE updates:**
1. Task status change — services call `sse_manager.notify_user(user_id, "update")` after writes
2. Scheduler jobs — `sse_manager.broadcast("update")` at 6pm and 1am daily (`backend/app/scheduler/jobs.py`)

**Frontend consumption:**
- `frontend/src/api/reminder.ts` (or similar in `frontend/src/features/reminder/`) — opens `EventSource` to `/api/v1/reminder/stream`

## Scheduler / Cron Jobs

**Provider:** APScheduler 3.10.4 `AsyncIOScheduler` — runs in-process, started and stopped via FastAPI `lifespan` context manager (`backend/app/main.py` lines 48-61)

**Jobs** (defined in `backend/app/scheduler/jobs.py`):

| Job ID | Schedule | Action |
|--------|----------|--------|
| `archive_and_spawn` | Daily at 4:00am (timezone from `SCHEDULER_TIMEZONE` setting, default UTC) | Archives completed tasks from previous day; spawns new recurring task instances due today |
| `push_reminder_at_6pm` | Daily at 6:00pm | Broadcasts `"update"` to all SSE clients |
| `push_reminder_at_1am` | Daily at 1:00am | Broadcasts `"update"` to all SSE clients |

Each job creates its own database session via `async_session_factory` + `UnitOfWork`. Jobs are independent — failure in one does not block others. Session rollback is called on exception.

## Database Migrations

**Tool:** Alembic 1.14.0

**Config:** `backend/alembic.ini` — `script_location = alembic`; URL is overridden at runtime from `app.config.settings` (not from `alembic.ini` directly, see `backend/alembic/env.py` line 19)

**Migration directory:** `backend/alembic/versions/`

**Migrations applied:**

| Revision | Description |
|----------|-------------|
| `001` | Initial schema — `users`, `topics`, `tasks`, `task_topics` (join), `refresh_tokens`, `recurring_templates`, `recurring_template_topics` (join), `recurring_instances`; PostgreSQL ENUMs: `taskstatus` (todo/in_progress/done), `recurringfrequency` (weekly/fortnightly/monthly) |
| `002` | Index on `refresh_tokens.token_hash` |
| `003` | Add `daily` to `recurringfrequency` enum + `due_date` column on recurring templates |
| `004` | Add `subtasks` table (id, task_id FK, title, status, sort_order, created_at, updated_at) + index `ix_subtasks_task_id` |

**Async migration runner:** `backend/alembic/env.py` uses `async_engine_from_config` + `asyncio.run()` — compatible with asyncpg driver.

**Auto-apply on startup:** Docker Compose commands include `python -m alembic upgrade head` before starting uvicorn (`docker-compose.yml` line 23, `docker-compose.dev.yml` line 14). CI also runs `pytest tests/integration/test_migrations.py` to verify migrations are current.

## CI/CD & Deployment

**Version Control:** Git, GitHub

**CI Pipeline:** GitHub Actions (`ci.yml`) — triggers on all branch pushes and PRs to `main`

| Job | What it does |
|-----|-------------|
| `backend` | Spins up postgres:16-alpine service container, runs `pytest tests/integration/test_migrations.py`, then `pytest --cov=app --cov-fail-under=80` |
| `frontend` | Runs `tsc --noEmit`, then `vitest run --coverage --coverage.thresholds.lines=80` |
| `docker-build` | Runs `docker compose build` (depends on backend + frontend passing) |
| `e2e` | Starts full `docker compose` stack, waits for port 8080, runs Playwright Chromium tests against `http://localhost:8080` (depends on docker-build) |

**CD Pipeline:** GitHub Actions (`deploy.yml`) — triggers on push to `main` only

- SSH into VPS (`appleboy/ssh-action@v1`) using secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- Commands on VPS: `cd /opt/todo-app`, `git fetch origin main`, `git reset --hard origin/main`, `docker compose build --memory 1g`, `docker compose up -d`
- Post-deploy health check: `curl --fail --retry 5 --retry-delay 5 https://todolist.cheap/api/health`
- Concurrency: `cancel-in-progress: false` — queues rather than cancels concurrent deploys

**Hosting:**
- VPS (self-managed Linux, path `/opt/todo-app`)
- Production domain: `todolist.cheap` (inferred from deploy health check in `deploy.yml` line 44)
- TLS terminated externally (Caddy, per project docs)

## Webhooks & Callbacks

**Incoming:**
- None detected — no webhook endpoints in any router file

**Outgoing:**
- None detected — no outbound HTTP calls to external services (httpx is available in requirements but used only in tests)

## Monitoring & Observability

**Error Tracking:**
- Sentry (conditional, see above under APIs & External Services)

**Logs:**
- Structured JSON logging via `python-json-logger` (`backend/app/logging_config.py`)
- Output: stderr by default; optional file path via `LOG_FILE` env var
- Format per line: `{asctime, levelname, name, message, ...extra}`
- Noisy loggers quieted: `uvicorn.access` → WARNING, `apscheduler` → WARNING
- Access log middleware (`backend/app/middleware/access_log.py`) attaches `user_id` from `request.state`

**Health Endpoint:**
- `GET /api/health` — no auth required; queries `SELECT 1` to test DB connectivity; returns `{"status": "ok", "db": "ok"}` (200) or `{"status": "degraded", "db": "unreachable"}` (503)

---

*Integration audit: 2026-06-19*
