# API Specification

> All endpoints prefixed with `/api/v1/`

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

All responses use this envelope:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

- `meta` only on paginated responses.
- On error: `data` is `null`, `error` contains a message string.

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
| PATCH | `/tasks/{id}/order` | Update manual sort order |

**Filter query params for `GET /tasks`:**
- `window`: `today` | `3days` | `week` | `all`
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
| GET | `/api/health` | Server + DB status (no auth) |

---

## Authentication

- JWT access tokens: 15 min expiry
- JWT refresh tokens: 7 days, HTTP-only cookie
- Passwords hashed with bcrypt
- Protected endpoints use `get_current_user` dependency
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
| `archive_done_tasks` | Daily 4:00 AM | Archive tasks with `status=done` and `done_at < today's 4am` |
| `create_recurring_instances` | Daily 4:00 AM | Create new task instances from active templates |
| `push_reminder_at_6pm` | Daily 6:00 PM | Broadcast reminder via SSE |
| `push_reminder_at_1am` | Daily 1:00 AM | Broadcast reminder via SSE |

---

## Error Handling

Global middleware catches all exceptions:

| Exception | HTTP Status | User Message |
|-----------|-------------|--------------|
| `AppError` | 400 | Business rule message |
| `LookupError` | 404 | "Resource not found" |
| `PermissionError` | 403 | "Not authorized" |
| Any `Exception` | 500 | "An internal server error occurred" |

Full tracebacks are logged server-side only.

---

## Environment Variables

```
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/todoapp
SECRET_KEY=<long random string>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
SCHEDULER_TIMEZONE=UTC
VITE_API_BASE_URL=/api/v1   # frontend build-time
```
