# API Specification

> All endpoints prefixed with `/api/v1/` — except the health check (`/api/health`).

---

## Backend Project Structure

```
backend/
├── app/
│   ├── main.py               # App init, middleware, router registration
│   ├── config.py             # Settings via pydantic-settings (reads .env)
│   ├── database.py           # Async SQLAlchemy engine, session factory
│   ├── models/               # SQLAlchemy ORM models
│   ├── schemas/              # Pydantic request/response schemas
│   ├── routers/              # FastAPI routers (HTTP layer only)
│   ├── services/             # Business logic
│   ├── repositories/         # DB queries only
│   ├── sse/                  # SSE connection manager for reminder push
│   ├── scheduler/            # APScheduler job definitions
│   ├── auth/                 # JWT + dependencies
│   └── middleware/           # Global exception handler
├── alembic/
├── tests/
├── Dockerfile
└── requirements.txt
```

---

## Standard API Response Format

Application (non-error and enveloped-error) responses use this envelope:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

- `meta` only on paginated responses.
- On enveloped errors (`AppError`, `LookupError`, `PermissionError`, unhandled `Exception`): `data` is `null`, `error` contains a message string.
- **Not enveloped** — these bypass the envelope and return their framework-default shape (see Error Handling below):
  - `401` auth failures (`HTTPException`) → `{"detail": "..."}`
  - `422` request validation (`RequestValidationError`) → `{"detail": [ ... ]}` (`error` is a list of objects, not a string)
  - `429` rate-limited (`RateLimitExceeded`) → slowapi default body
  - `GET /api/health` → `{"status": ..., "db": ...}`

---

## Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT access + refresh token |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List active tasks (filter params below) |
| POST | `/tasks` | Create a task |
| GET | `/tasks/{id}` | Get single task |
| PATCH | `/tasks/{id}` | Update task fields |
| DELETE | `/tasks/{id}` | Delete task |
| PATCH | `/tasks/{id}/status` | Update task status |
| PATCH | `/tasks/{id}/order` | Update manual sort order (single task) |
| POST | `/tasks/reorder` | Batch update manual sort order (used by drag-and-drop) |
| POST | `/tasks/bulk-delete` | Delete multiple tasks in one request (1–50 ids) |

**Filter query params for `GET /tasks`:**
- `window`: `today` | `3days` | `week` | `all` — unrecognized values are currently **ignored** (treated as no window filter), not rejected
- `topic_id`: UUID
- `q`: search query string
- `page`: integer, default `1`
- `limit`: integer, default `20`, max `30`

### Topics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/topics` | List all topics |
| POST | `/topics` | Create topic |
| PATCH | `/topics/{id}` | Rename topic |
| DELETE | `/topics/{id}` | Delete topic |

### Archive
| Method | Path | Description |
|--------|------|-------------|
| GET | `/archive` | List archived tasks (paginated) |
| POST | `/archive/{id}/restore` | Restore archived task |

### Recurring
| Method | Path | Description |
|--------|------|-------------|
| GET | `/recurring` | List recurring templates |
| POST | `/recurring` | Create recurring template |
| PATCH | `/recurring/{id}` | Update template |
| POST | `/recurring/{id}/stop` | Stop template (is_active=false) |
| DELETE | `/recurring/{id}` | Delete template permanently |

### Subtasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/{task_id}/subtasks` | List subtasks for a task |
| POST | `/tasks/{task_id}/subtasks` | Create subtask under a task |
| PATCH | `/tasks/{task_id}/subtasks/{subtask_id}` | Update subtask (title, status, sort_order) |
| DELETE | `/tasks/{task_id}/subtasks/{subtask_id}` | Delete subtask |

### Reminder
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reminder` | Get current reminder message |
| GET | `/reminder/stream` | SSE stream for live updates |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + DB status (no auth, no `v1` prefix, non-enveloped; returns `503` if DB unreachable) |

---

## Authentication

- JWT access tokens: 15 min expiry
- JWT refresh tokens: 7 days, HTTP-only cookie
- Passwords hashed with bcrypt
- Protected endpoints use the `get_current_user_id` dependency (returns the authenticated user's `UUID`)
- Refresh tokens stored in DB for revocation

---

## Connection Pooling

```
pool_size=10, max_overflow=20, pool_timeout=30, pool_recycle=1800
```

Configurable via environment variables.

---

## Scheduled Jobs (APScheduler)

All times use server timezone (`SCHEDULER_TIMEZONE` env var). Timestamps stored in UTC.

| Job | Schedule | Description |
|-----|----------|-------------|
| `archive_and_spawn` | Daily 4:00 AM | One job that runs two steps in sequence: (1) archive `done` tasks past their 4am boundary, then (2) create new task instances from active recurring templates |
| `push_reminder_at_6pm` | Daily 6:00 PM | Broadcast reminder via SSE |
| `push_reminder_at_1am` | Daily 1:00 AM | Broadcast reminder via SSE |

---

## Error Handling

Global middleware catches all exceptions:

| Exception | HTTP Status | Response body |
|-----------|-------------|--------------|
| `AppError` | 400 | Enveloped — business rule message in `error` |
| `LookupError` | 404 | Enveloped — "Resource not found" |
| `PermissionError` | 403 | Enveloped — "Not authorized" |
| Any `Exception` | 500 | Enveloped — "An internal server error occurred" |
| `HTTPException` (auth) | 401 | **Not enveloped** — FastAPI default `{"detail": "..."}` |
| `RequestValidationError` | 422 | **Not enveloped** — `{"detail": [ ... ]}` |
| `RateLimitExceeded` | 429 | **Not enveloped** — slowapi default body |

Only `AppError`, `LookupError`, `PermissionError`, and unhandled `Exception` are mapped to the standard envelope (`middleware/error_handler.py`). `HTTPException`, validation, and rate-limit responses are returned by FastAPI/slowapi defaults and do **not** use the envelope. Full tracebacks are logged server-side only.

---

## Environment Variables

```
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/todoapp
TEST_DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/todoapp_test
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

# Auth (SECRET_KEY is required — the app refuses to start without it)
SECRET_KEY=<long random string>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (comma-separated list)
ALLOWED_ORIGINS=http://localhost

# Rate limiting (override with stricter values in production)
RATE_LIMIT_ENABLED=true
REGISTER_RATE_LIMIT=100/minute
LOGIN_RATE_LIMIT=100/minute
REFRESH_RATE_LIMIT=200/minute

# Scheduler
SCHEDULER_TIMEZONE=UTC

# Logging
LOG_LEVEL=INFO
LOG_FILE=                          # empty = stderr only

# Observability (Sentry)
SENTRY_DSN=                        # empty = disabled
SENTRY_TRACES_SAMPLE_RATE=0.2
ENVIRONMENT=production

# Frontend (build-time)
VITE_API_BASE_URL=/api/v1
```
