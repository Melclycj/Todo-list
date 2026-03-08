# Engineering Practices & Operational Readiness

> Audit date: 2026-03-04 | Last updated: 2026-03-08 | Stack: FastAPI + React 19 + PostgreSQL

---

## Table of Contents

1. [Error Handling Audit](#1-error-handling-audit)
2. [Web Application Optimizations](#2-web-application-optimizations)
3. [Logging Assessment](#3-logging-assessment)
4. [Live Application Monitoring](#4-live-application-monitoring)
5. [Version Control Best Practices](#5-version-control-best-practices)

---

## 1. Error Handling Audit

### Verdict: No raw DB errors are exposed to users ✅

The backend implements a layered exception model that prevents any internal error detail from leaking to HTTP responses.

### Error Flow

```
Repository (SQLAlchemy / asyncpg)
    └── raw exception raised
Service
    └── re-raised, or converted to AppError / LookupError / PermissionError
Router
    └── bubbles up (no try/except needed)
Global Exception Handler (middleware/error_handler.py)
    ├── AppError       → 400 { "detail": "<safe business message>" }
    ├── LookupError    → 404 { "detail": "Resource not found" }
    ├── PermissionError→ 403 { "detail": "Not authorized" }
    └── Exception      → 500 { "detail": "An internal server error occurred" }
                            (full traceback logged server-side only)
```

### Handlers registered in `main.py`

| Exception type | HTTP status | User-visible message | Server log |
|---|---|---|---|
| `AppError` | 400 | Business rule message (safe) | None |
| `LookupError` | 404 | `"Resource not found"` | None |
| `PermissionError` | 403 | `"Not authorized"` | None |
| Any `Exception` | 500 | `"An internal server error occurred"` | Full traceback via `logger.exception` |

### Database session safety (`database.py`)

```python
async with async_session_factory() as session:
    try:
        yield session
    except Exception:
        await session.rollback()   # always rolled back on error
        raise                      # re-raised to global handler
    finally:
        await session.close()
```

SQLAlchemy / asyncpg exceptions are rolled back and then caught by the global handler, which returns `500` with a generic message. The raw DB error is never forwarded.

### User-facing messages in services

| Service | Message | Type |
|---|---|---|
| `auth_service.py` | `"Email already in use"` | AppError |
| `auth_service.py` | `"Invalid credentials"` (deliberate vagueness) | AppError |
| `auth_service.py` | `"Invalid refresh token"`, `"Refresh token expired"` | AppError |
| `task_service.py` | `"Title must not be empty"`, `"Title must not exceed 255 characters"` | AppError |
| `task_service.py` | Status transition messages | AppError |
| `topic_service.py` | `"Maximum of 10 topics reached"`, `"Topic already exists"` | AppError |
| `auth/dependencies.py` | `"Invalid or expired token"` | HTTPException 401 |

### One gap to address

**`recurring_service.py` line 51** raises a plain `ValueError`, not an `AppError`:

```python
raise ValueError(f"Unknown frequency: {frequency}")
```

Because the global handler does not distinguish `ValueError` from other exceptions (only `AppError` is caught at 400), this will return a generic 500 to the user. It should be:

```python
raise AppError(f"Unknown frequency: {frequency}")
```

---

## 2. Web Application Optimizations

### Universal optimizations and applicability to this project

#### Backend

| Optimization | What it is | Status | Notes |
|---|---|---|---|
| **Database connection pooling** | Reuse DB connections instead of opening a new one per request | ✅ Done | SQLAlchemy async pool used |
| **Query optimization / N+1 prevention** | Fetch related data in one query instead of N | ✅ Done | `selectinload` used in repositories; no lazy-loading |
| **Database indexing** | Index columns used in WHERE / ORDER BY | ⚠️ Pending | Add indexes on `user_id`, `status`, `due_date` via Alembic migration |
| **Response caching (HTTP headers)** | `Cache-Control`, `ETag` headers on static data | ⚠️ Partial | Useful for topic list (rarely changes); not tasks |
| **In-process caching (e.g., Redis)** | Cache expensive query results | ⚠️ Later | Adds infrastructure; worthwhile if user count grows |
| **Pagination** | Return pages of results instead of all rows | ✅ Done | Limit defaults enforced in all list endpoints |
| **Rate limiting** | Throttle requests per client | ✅ Done | `slowapi` installed and integrated on all endpoints |
| **Async I/O everywhere** | Non-blocking DB and network calls | ✅ Done | Full async stack: FastAPI + asyncpg + SQLAlchemy async |
| **Compression (gzip/brotli)** | Compress HTTP responses | ✅ Done | `GZipMiddleware` added; `brotli` installed for auto-negotiation |
| **Background tasks for non-critical work** | Offload slow work from the request path | ✅ Done | APScheduler handles archiving and recurring task spawning |
| **SSE over polling** | Push updates instead of client polling | ✅ Done | Reminder SSE endpoint implemented; exponential-backoff reconnect |
| **Unit of Work pattern** | Atomic multi-step writes across repositories | ✅ Done | All services own the commit boundary; repos are flush-only |
| **Scheduler race guard** | Prevent duplicate task spawning under concurrent workers | ✅ Done | `SELECT FOR UPDATE SKIP LOCKED` on `get_due_templates()` |

#### Frontend

| Optimization | What it is | Status | Notes |
|---|---|---|---|
| **Code splitting** | Load JS bundles on demand | ✅ Done | `manualChunks` in `vite.config.ts`; 7 separate chunks |
| **Tree shaking** | Remove unused exports at build time | ✅ Done | Vite + ESM; all libraries imported by named export |
| **Image optimization** | Compress and serve correct formats | ➖ N/A | No user images in this app |
| **React Query caching** | Cache and deduplicate API calls | ✅ Done | `@tanstack/react-query` used throughout |
| **Optimistic UI updates** | Update UI before server confirms | ⚠️ Optional | Improves perceived speed for status toggles |
| **Virtualization** | Render only visible rows in long lists | ⚠️ Future | Use `@tanstack/react-virtual` if task lists grow past ~200 rows |
| **Debounce / throttle** | Limit how often events fire | ✅ Done | Search debounced (300ms); resize drag handlers RAF-throttled |
| **Service Worker / PWA** | Cache assets offline | ⚠️ Future | Nice-to-have for mobile use |
| **Bundle size audit** | Identify oversized dependencies | ✅ Done | `react-dom/client` split fixed; `index.js` reduced 352 KB → 96 KB (gzip: 111 KB → 29 KB) |
| **Font optimization** | Subset fonts, use `font-display: swap` | ⚠️ If custom fonts added | Not applicable currently |

#### Bundle breakdown (post-audit)

| Chunk | Size (minified) | Gzipped | Contents |
|---|---|---|---|
| `vendor-react` | 229 KB | 73 KB | react, react-dom, react-dom/client, react-router-dom |
| `vendor-radix` | 94 KB | 29 KB | All Radix UI primitives + floating-ui |
| `index` | 96 KB | 29 KB | App code + date-fns + tailwind-merge + clsx |
| `vendor-http` | 37 KB | 15 KB | axios |
| `vendor-ui` | 39 KB | 12 KB | sonner, lucide-react |
| `vendor-query` | 36 KB | 11 KB | @tanstack/react-query |
| Page chunks | < 6 KB each | < 2 KB | ArchivePage, RecurringPage, TopicListPage |

#### Database (pending — most impactful remaining item)

```sql
-- Recommended indexes for the tasks table
CREATE INDEX idx_tasks_user_id     ON tasks(user_id);
CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_tasks_due_date    ON tasks(due_date);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);  -- composite for filtered lists
```

Add these via an Alembic migration.

#### Remaining action items (low effort, high impact)

1. **Database indexes** — Alembic migration, zero app code change
2. **Structured JSON logging** — add `python-json-logger`, request ID middleware, access log middleware

---

## 3. Logging Assessment

### Current state: Minimal, not structured

Only 2 files produce application logs:

| File | What is logged | Format |
|---|---|---|
| `middleware/error_handler.py` | Unhandled 500 errors with method + URL | `logger.exception(...)` |
| `scheduler/jobs.py` | Job success counts and job failures | `logger.info(...)` / `logger.exception(...)` |

### What is missing

| Gap | Impact |
|---|---|
| No request logging (method, path, status, duration) | Cannot see traffic patterns or slow endpoints |
| No user ID / request ID in log context | Cannot trace a specific user's request across log lines |
| No service-layer logging (e.g., "task created for user X") | No audit trail |
| No structured format (JSON) | Hard to query logs in tools like Datadog, Loki, CloudWatch |
| No log level configuration from environment | Cannot switch between DEBUG and INFO without code change |

### What good structured logging looks like

**Current (unstructured):**
```python
logger.exception("Unhandled exception on %s %s", request.method, request.url)
```

**Improved (structured with context):**
```python
logger.error(
    "Unhandled exception",
    extra={
        "method": request.method,
        "path": request.url.path,
        "request_id": request.state.request_id,
        "user_id": getattr(request.state, "user_id", None),
        "exc_info": True,
    }
)
```

With a JSON formatter (e.g., `python-json-logger`), each log line becomes a queryable JSON object in your log aggregator.

### Recommended additions

**1. Request ID middleware** — attach a UUID to every request, include it in all logs and response headers (`X-Request-ID`).

**2. Access log middleware** — log method, path, status code, and response time for every request:
```
{"event": "request", "method": "GET", "path": "/api/tasks", "status": 200, "duration_ms": 14, "request_id": "abc123"}
```

**3. Structured logger configuration in `main.py`:**
```python
import logging
import json

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",  # let JSON formatter handle structure
)
```

**4. Service-layer audit logs** for security-sensitive operations:
```python
logger.info("User logged in", extra={"user_id": str(user.id)})
logger.info("Task deleted", extra={"user_id": str(user_id), "task_id": str(task_id)})
```

---

## 4. Live Application Monitoring

These are the standard signals that ops teams track for web applications.

### The Four Golden Signals (Google SRE)

| Signal | What to measure | Tool examples |
|---|---|---|
| **Latency** | How long requests take (p50, p95, p99) | Prometheus + Grafana, Datadog APM |
| **Traffic** | Requests per second per endpoint | Same |
| **Errors** | Error rate (4xx, 5xx), error types | Sentry, Rollbar |
| **Saturation** | CPU, memory, DB connections, queue depth | Node exporter, pg_stat_activity |

### What to monitor for this specific application

#### Infrastructure

| Metric | Alert threshold |
|---|---|
| CPU usage | > 80% sustained for 5 min |
| Memory usage | > 85% |
| Disk usage | > 80% |
| Database connections | > 80% of pool max |
| Container restart count | Any restart |

#### Application

| Metric | Alert threshold |
|---|---|
| HTTP 5xx error rate | > 1% of requests |
| HTTP 4xx error rate | > 10% (possible attack or bad deploy) |
| API response time p95 | > 500ms |
| API response time p99 | > 2s |
| Scheduler job failure | Any failure |
| SSE connection count | Spike (possible connection leak) |
| Failed login attempts | > 10/min per IP (brute force) |

#### Database (PostgreSQL)

| Metric | Why |
|---|---|
| Query execution time | Detect N+1 or missing indexes |
| Active connections | Pool exhaustion risk |
| Table bloat / dead tuples | Triggers VACUUM alert |
| Lock wait time | Detects deadlocks or long transactions |
| Replication lag (if replica) | Data freshness |

### Recommended minimal monitoring stack (self-hosted)

```
Application → Prometheus metrics → Grafana dashboards
Application → stdout JSON logs → Loki → Grafana
Application → Sentry SDK → Sentry (error tracking)
```

### Recommended minimal monitoring stack (managed)

```
Sentry                  → error tracking, performance tracing (free tier generous)
Uptime Robot / BetterStack → uptime / SSL expiry alerts (free tier)
VPS provider metrics    → CPU, memory, disk from your hosting panel
```

### Health check endpoint

Ensure `/health` returns a meaningful response:

```json
{
  "status": "ok",
  "db": "ok",
  "version": "1.2.0"
}
```

This is the target for uptime monitors and container health checks. If the DB is unreachable it should return `503`.

### Alerts to set up on day one

1. Site is down (uptime monitor pings `/health`)
2. SSL certificate expires in < 14 days
3. Disk > 80%
4. Any container restart
5. 5xx error rate spike

---

## 5. Version Control Best Practices

### Branch strategy (recommended for this project)

```
main          ← production-ready only; protected branch
├── DEV       ← integration branch; all features merged here first
│   ├── feat/task-recurring-ui
│   ├── fix/reminder-sse-leak
│   └── chore/upgrade-fastapi
```

**Rules:**
- `main` is protected: no direct pushes, require PR + review
- `DEV` is the integration target; deploy from here to staging
- Short-lived feature branches: merge within days, not weeks
- Delete branches after merge

### Commit message convention (Conventional Commits)

```
<type>(<scope>): <short summary>

<optional body explaining why, not what>

<optional footer: BREAKING CHANGE, closes #issue>
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New feature visible to users |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Tooling, dependencies, CI |
| `docs` | Documentation only |
| `ci` | CI/CD pipeline changes |

**Examples:**
```
feat(tasks): add bulk delete with confirmation dialog
fix(auth): prevent token reuse after logout
chore(deps): upgrade fastapi to 0.135.1 for starlette CVE fix
perf(db): add composite index on (user_id, status)
```

### What to always `.gitignore`

```gitignore
# Secrets
.env
.env.*
!.env.example

# Python
__pycache__/
*.pyc
.venv/
venv/

# Node
node_modules/
dist/

# Editor
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Test artifacts
.coverage
htmlcov/
playwright-report/
test-results/
```

### Tagging releases

Tag every production deployment:

```bash
git tag -a v1.2.0 -m "Release v1.2.0: bulk delete, topic filters"
git push origin v1.2.0
```

Follow **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
- `MAJOR` — breaking API change
- `MINOR` — new feature, backward-compatible
- `PATCH` — bug fix

### Pull request checklist

Before merging any PR:

- [ ] Tests pass (unit + integration)
- [ ] No new `npm audit` or `pip-audit` vulnerabilities introduced
- [ ] No secrets or `.env` files committed
- [ ] Migrations are reversible (have a `downgrade()`)
- [ ] `CHANGELOG.md` updated (for user-facing changes)
- [ ] Branch is up to date with `DEV`

### Protecting `main`

In GitHub → Settings → Branches → Add rule for `main`:

- [x] Require pull request before merging
- [x] Require at least 1 approval
- [x] Require status checks to pass (CI)
- [x] Do not allow bypassing the above settings

### Changelog (`CHANGELOG.md`)

Keep a human-readable log of changes at the project root. Format:

```markdown
## [Unreleased]

## [1.2.0] - 2026-03-04
### Added
- Bulk delete tasks with confirmation dialog
- Topic filter in sidebar

### Fixed
- SSE connection not cleaned up on browser close

## [1.1.0] - 2026-02-10
### Added
- Recurring task templates
```

---

## Quick Reference: Action Items

| Priority | Area | Action | Status |
|---|---|---|---|
| 🔴 High | Error handling | Fix `ValueError` → `AppError` in `recurring_service.py` | ✅ Done |
| 🔴 High | Database | Add DB indexes via Alembic migration | ⚠️ Pending |
| 🟡 Medium | Performance | Add `GZipMiddleware` + brotli to `main.py` | ✅ Done |
| 🟡 Medium | Performance | Unit of Work pattern — atomic multi-step service writes | ✅ Done |
| 🟡 Medium | Performance | Scheduler race guard — `SELECT FOR UPDATE SKIP LOCKED` | ✅ Done |
| 🟡 Medium | Performance | Bundle audit — `react-dom/client` split, axios/sonner extracted | ✅ Done |
| 🟡 Medium | Performance | RAF-throttle sidebar and column resize drag handlers | ✅ Done |
| 🟡 Medium | Logging | Add request ID middleware + access log middleware | ⚠️ Pending |
| 🟡 Medium | Logging | Switch to structured JSON logging with `python-json-logger` | ⚠️ Pending |
| 🟡 Medium | Monitoring | Set up Sentry (free tier) for error tracking | ⚠️ Pending |
| 🟡 Medium | Monitoring | Set up uptime monitor on `/health` endpoint | ⚠️ Pending |
| 🟢 Low | Monitoring | Add Prometheus metrics + Grafana dashboard | ⚠️ Future |
| 🟢 Low | Version control | Protect `main` branch on GitHub | ⚠️ Pending |
| 🟢 Low | Version control | Start tagging releases with `git tag` | ⚠️ Pending |
