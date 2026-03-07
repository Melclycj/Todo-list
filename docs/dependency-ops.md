# Dependency Operations & Database Index Reference

> Companion to `engineering-practices.md` | Updated: 2026-03-04

---

## Table of Contents

1. [Applying Dependency Updates on the VPS](#1-applying-dependency-updates-on-the-vps)
2. [Verifying Dependencies Pass All Tests](#2-verifying-dependencies-pass-all-tests)
3. [Database Index Justification](#3-database-index-justification)
4. [Changelog](#4-changelog)

---

## 1. Applying Dependency Updates on the VPS

### What changed in this update

| File | Change |
|---|---|
| `backend/requirements.txt` | `fastapi` 0.115.6 → 0.135.1, `python-multipart` 0.0.17 → 0.0.22 |
| `frontend/package.json` | Removed 9 unused packages (dnd-kit, 3× radix, devtools, cmdk, react-day-picker) |
| `frontend/vite.config.ts` | Removed `vendor-dnd` chunk entry |

### Why you must rebuild Docker images

Dependencies are baked into the Docker image at build time:
- `pip install -r requirements.txt` runs inside `backend/Dockerfile`
- `npm install` runs inside `frontend/Dockerfile`

Restarting containers **without** rebuilding will continue running the old image with the old packages. You must `--build`.

### Commands to run on the VPS

```bash
# 1. SSH into your server
ssh user@your-vps-ip

# 2. Go to the project directory
cd /path/to/Todo-list

# 3. Pull the latest code from the DEV branch
git pull origin DEV

# 4. Rebuild images and restart containers
#    --build  : forces Docker to re-run pip install / npm install
#    -d       : detached (runs in background)
#    --no-cache is optional — use it if you suspect a stale layer
docker compose up --build -d

# 5. Verify all containers are healthy
docker compose ps

# 6. Confirm the API started and migrations ran
docker compose logs api --tail=40
```

Expected output from step 6:
```
INFO  [alembic.runtime.migration] Running upgrade ... -> 004, ...
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Verify the vulnerability fixes took effect

```bash
# Inside the running api container
docker compose exec api python -m pip_audit -r requirements.txt
```

Expected:
```
No known vulnerabilities found
```
(The `ecdsa` CVE will remain — no upstream fix exists; see engineering-practices.md §1.)

### Rollback procedure

If something goes wrong after the rebuild:

```bash
# Revert to the previous image (the one built before git pull)
docker compose down
git stash          # or git reset --hard HEAD~1
docker compose up --build -d
```

---

## 2. Verifying Dependencies Pass All Tests

### Backend unit tests (no database required)

```bash
cd backend
pip install -r requirements.txt       # install updated deps locally

# Run unit tests only (fast, no DB)
pytest tests/unit/ -v
```

Expected: all unit tests pass. These are fully mocked and have no external dependencies.

### Backend integration tests (requires PostgreSQL)

Integration tests need a running Postgres with a `_test` database. Use the dev compose stack:

```bash
# From project root — start only the database service
docker compose -f docker-compose.dev.yml up db -d

# Wait for it to be healthy, then run all tests
cd backend
TEST_DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/todolist_test" \
pytest tests/ -v --cov=app --cov-report=term-missing
```

Or run everything inside Docker (mirrors CI exactly):

```bash
# From project root
docker compose -f docker-compose.dev.yml run --rm api \
  pytest tests/ -v --cov=app --cov-report=term-missing
```

Coverage threshold is **80%** (enforced in `pytest.ini` via `pytest-cov`).

### Frontend unit tests

```bash
cd frontend
npm install          # install updated deps

npm test             # runs vitest in run mode (non-watch)
npm run test:coverage  # with coverage report
```

### Frontend E2E tests

E2E tests require the full stack running:

```bash
# Start full stack
docker compose up -d

# Run Playwright
cd frontend
npm run test:e2e
```

### Full CI-equivalent check (one command)

The GitHub Actions pipeline runs this sequence. Mirror it locally to be certain:

```bash
# 1. Backend unit + integration
docker compose -f docker-compose.dev.yml up db -d
cd backend && pytest tests/ -v

# 2. Frontend unit
cd ../frontend && npm test

# 3. Re-run vulnerability scan to confirm no regressions
cd ../backend && python -m pip_audit -r requirements.txt
cd ../frontend && npm audit
```

### What a clean run looks like

```
backend  ✓  XX passed in Xs
frontend ✓  XX passed in Xs
pip-audit: No known vulnerabilities found (ecdsa CVE-2024-23342 remains — no fix)
npm audit: found 0 vulnerabilities
```

---

## 3. Database Index Justification

### Current index inventory (from migrations 001–003)

| Index | Created by | Covers |
|---|---|---|
| `tasks.id` PK | migration 001 | Single task lookup |
| `users.email` UNIQUE | migration 001 | Login lookup |
| `topics(user_id, name)` UNIQUE | migration 001 | Topic uniqueness check |
| `task_topics(task_id, topic_id)` PK | migration 001 | Join table traversal from task side |
| `refresh_tokens.token_hash` UNIQUE | migration 002 | Token rotation lookup |
| `recurring_templates.id` PK | migration 001 | Template lookup |

**Missing:** `tasks(user_id)`, `tasks(due_date)`, `task_topics(topic_id)`, `tasks(status, archived)`.

---

### Query-by-query analysis

Every proposed index is traced to a concrete query in `task_repository.py`.

---

#### Index 1 — `tasks(user_id)`

**Query it serves** (`list_active`, line 119–124):
```sql
SELECT tasks.*
FROM   tasks
WHERE  tasks.user_id = :user_id      -- ← every task query starts here
  AND  tasks.archived = false
  AND  ( tasks.status IN ('todo','in_progress')
         OR (tasks.status = 'done' AND tasks.done_at >= :today_4am) )
```

**Without index:** PostgreSQL performs a sequential scan of the entire `tasks` table and discards rows that don't belong to the user. Every user's request scans every row in the database.

**With index:** PostgreSQL uses an index scan to jump directly to the rows for that `user_id`. The number of rows examined equals only that user's tasks, not the whole table.

**Impact:** At 1 000 users × 50 tasks each = 50 000 rows, a sequential scan reads 50 000 rows to return 50. The index reduces that to ~50 rows read. The ratio improves linearly as the table grows. This index benefits `list_active`, `list_archived`, `count_tasks_in_window`, `count_done_tasks_in_window`, and `bulk_delete_for_user` — every single query in the repository.

---

#### Index 2 — `tasks(user_id, archived)` (composite)

**Query it serves** — `list_active` (active = `archived = false`) and `list_archived` (archived = `archived = true`):
```sql
-- list_active
WHERE tasks.user_id = :user_id AND tasks.archived = false

-- list_archived
WHERE tasks.user_id = :user_id AND tasks.archived = true
```

**Without index:** Even with the `user_id` single-column index above, PostgreSQL must read all of the user's rows and then filter on `archived`.

**With composite index:** The index encodes both columns together. PostgreSQL reads only the subset of that user's rows where `archived = false` (or `true`). For a user with 200 tasks and 180 archived, `list_active` scans ~20 rows instead of 200.

**Why order matters:** `(user_id, archived)` not `(archived, user_id)` — PostgreSQL can use a composite index when you filter the leftmost column(s). Since every query filters `user_id` first, it must be the leading column.

---

#### Index 3 — `tasks(due_date)`

**Queries it serves:**

`list_active` ORDER BY clause (line 170):
```sql
ORDER BY tasks.due_date ASC NULLS LAST,
         tasks.manual_order ASC NULLS LAST
```

`list_active` window filters (lines 128–148):
```sql
-- "today" window
WHERE tasks.due_date >= :today_4am AND tasks.due_date <= :today_end

-- "3days" / "week" window
WHERE tasks.due_date <= :cutoff
```

`count_tasks_in_window` and `count_done_tasks_in_window` (lines 224–255):
```sql
WHERE tasks.due_date >= :window_start AND tasks.due_date < :window_end
```

**Without index:** Sorting by `due_date` on a large result set requires a filesort (in-memory or on-disk sort of all qualifying rows).

**With index:** When the filtered row count is moderate, PostgreSQL can perform an index scan in sorted order and skip the sort step entirely. For the reminder count queries, the range filter `due_date BETWEEN x AND y` becomes a fast index range scan.

**Interaction with the composite index:** `tasks(user_id, due_date)` would cover both user filtering and date range/ordering in one index (see Index 4 below), making the standalone `due_date` index secondary. Keep it for the scheduler's `get_unarchived_done_tasks` which does **not** filter by `user_id` but does filter by `due_date` windows.

---

#### Index 4 — `tasks(user_id, due_date)` (composite, highest value)

**Queries it serves** — the two reminder count queries that are called on every SSE heartbeat (every 30 seconds per connected user):

```sql
-- count_tasks_in_window (task_repository.py line 231)
WHERE tasks.user_id = :user_id
  AND tasks.due_date >= :window_start
  AND tasks.due_date < :window_end
  AND tasks.archived = false

-- count_done_tasks_in_window (line 247)
WHERE tasks.user_id = :user_id
  AND tasks.status = 'done'
  AND tasks.due_date >= :window_start
  AND tasks.due_date < :window_end
  AND tasks.archived = false
```

**Without index:** Each SSE heartbeat issues two count queries, each doing a user-id filter + date range scan. At 50 connected users, that is 100 scans per 30 seconds.

**With composite index:** PostgreSQL uses an index range scan: seek to the user's section of the index, then scan the narrow date range. The read is proportional to tasks in the window, not total tasks.

**This is the highest-priority index** because reminder queries run on a timer for every connected user, not just on user action.

---

#### Index 5 — `tasks(status, archived)` (composite)

**Query it serves** — `get_unarchived_done_tasks` (line 197), called by the nightly scheduler:

```sql
SELECT tasks.*
FROM   tasks
WHERE  tasks.status = 'done'
  AND  tasks.archived = false
```

**Without index:** Full table scan across all users' tasks to find done-but-unarchived ones.

**With index:** Direct index scan to the `(done, false)` combination. The number of rows read equals only the tasks awaiting archiving, regardless of total table size.

**Note:** This query has no `user_id` filter — it intentionally scans all users. So the leading column cannot be `user_id`. The `(status, archived)` composite is the right choice.

---

#### Index 6 — `task_topics(topic_id)`

**Query it serves** — the topic filter subquery in `list_active` (line 152–158):

```sql
WHERE tasks.id IN (
    SELECT task_topics.task_id
    FROM   task_topics
    WHERE  task_topics.topic_id = :topic_id
)
```

**Without index:** When filtering by topic, PostgreSQL scans the entire `task_topics` join table looking for rows where `topic_id` matches. The existing composite PK `(task_id, topic_id)` is sorted by `task_id` first, so it cannot accelerate a lookup by `topic_id`.

**With index:** PostgreSQL jumps directly to all rows for that `topic_id`, then returns the corresponding `task_id` values. For a topic with 30 tasks in a 10 000-row join table, the scan drops from 10 000 to 30 rows.

---

### Index migration (add as migration 004)

```python
"""Add performance indexes on tasks and task_topics

Revision ID: 004
Revises: 003
Create Date: 2026-03-04
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Every query in task_repository.py starts with user_id
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])

    # list_active and list_archived both filter (user_id, archived)
    op.create_index("ix_tasks_user_id_archived", "tasks", ["user_id", "archived"])

    # Reminder count queries filter (user_id, due_date) range — highest frequency
    op.create_index("ix_tasks_user_id_due_date", "tasks", ["user_id", "due_date"])

    # ORDER BY due_date and standalone window filters
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])

    # Scheduler archiving job: WHERE status='done' AND archived=false (no user_id)
    op.create_index("ix_tasks_status_archived", "tasks", ["status", "archived"])

    # Topic filter subquery in list_active: WHERE topic_id = :id
    op.create_index("ix_task_topics_topic_id", "task_topics", ["topic_id"])


def downgrade() -> None:
    op.drop_index("ix_task_topics_topic_id", table_name="task_topics")
    op.drop_index("ix_tasks_status_archived", table_name="tasks")
    op.drop_index("ix_tasks_due_date", table_name="tasks")
    op.drop_index("ix_tasks_user_id_due_date", table_name="tasks")
    op.drop_index("ix_tasks_user_id_archived", table_name="tasks")
    op.drop_index("ix_tasks_user_id", table_name="tasks")
```

Save this as `backend/alembic/versions/004_task_performance_indexes.py`. The indexes are created `CONCURRENTLY` by Postgres when run via Alembic on a live database, meaning no table lock is taken.

> **Note:** Alembic's `op.create_index` does not pass `CONCURRENTLY` by default. For zero-downtime deployment on a live database with existing data, run the migration manually with `CREATE INDEX CONCURRENTLY` first, then mark it as applied with `alembic stamp 004`.

---

### Priority summary

| Index | Query | Calls per user session | Priority |
|---|---|---|---|
| `tasks(user_id, due_date)` | `count_tasks_in_window` × 2 | Every 30s (SSE) | 🔴 Highest |
| `tasks(user_id, archived)` | `list_active`, `list_archived` | Every page load | 🔴 High |
| `task_topics(topic_id)` | topic filter subquery | Every filtered list | 🟡 Medium |
| `tasks(status, archived)` | scheduler archive job | Once per day | 🟡 Medium |
| `tasks(due_date)` | ORDER BY, window filter | Every list | 🟡 Medium |
| `tasks(user_id)` | all queries (covered by composites) | Every query | 🟢 Low (superseded) |

The composite indexes on `(user_id, archived)` and `(user_id, due_date)` make the single-column `tasks(user_id)` index largely redundant for this query set, but it is cheap to maintain and PostgreSQL will choose it for queries that don't filter `archived` or `due_date`.

---

## 4. Changelog

No `CHANGELOG.md` existed before this document. The following is reconstructed from git history.

---

```markdown
# Changelog

All notable changes to this project are documented here.
Format: [Semantic Versioning](https://semver.org)

## [Unreleased] — DEV branch

### Security
- Upgraded `fastapi` 0.115.6 → 0.135.1 (fixes starlette CVE-2025-54121, CVE-2025-62727)
- Upgraded `python-multipart` 0.0.17 → 0.0.22 (fixes CVE-2024-53981, CVE-2026-24486)
- Removed 9 unused frontend packages (reduced attack surface and bundle size)

### Chore
- Added performance indexes migration (tasks user_id, due_date, status/archived composites)
- Added engineering-practices.md and dependency-ops.md documentation

---

## [0.5.0] — 2026-03-04

### Added
- Topics column in task table with inline topic selector
- Edit mode with multi-select and bulk delete
- Maximum 10 topics limit per user enforced in backend

### Fixed
- Reminder SSE port updated to 8080 for Caddy reverse proxy compatibility
- E2E tests updated to match new bulk-delete flow
- Topic service unit tests mock `count_for_user`

---

## [0.4.0] — 2026-03-03

### Added
- Daily frequency for recurring task templates
- `due_date` column on recurring templates
- Full recurring task feature: templates, instances, scheduler jobs

### Fixed
- Browser memory leak vectors closed (event listener cleanup)
- Rate limits made configurable; disabled in test environment
- `python-jose` upgraded; `token_hash` unique index added (migration 002)
- HIGH/MEDIUM security findings from auth review addressed

---

## [0.3.0] — 2026-02-28

### Added
- Inline cell editing directly in the task table
- Absolute table column widths with resizable columns
- Resizable sidebar
- Status badges

### Fixed
- Column widths storage key bumped to v2 to clear stale cached defaults
- TypeScript build errors resolved
- CI `.env` setup corrected for Docker build

---

## [0.2.0] — 2026-02-27

### Added
- Full UI redesign: table layout replacing card-based layout
- Resizable sidebar and column headers (`useColumnResize` hook)
- Frontend unit tests (Vitest) for API layer and utilities

### Fixed
- Alembic migration aligned with model (`UniqueConstraint` on `users.email`)
- CI pipeline: PYTHONPATH, postgres env vars, dummy `.env` for Docker build

---

## [0.1.0] — 2026-02-26

### Added
- FastAPI backend with SQLAlchemy async, Alembic, asyncpg
- Full authentication: JWT access/refresh tokens, bcrypt hashing, rate limiting
- Tasks CRUD with status transitions, due dates, archiving
- Topics management (many-to-many with tasks)
- APScheduler background jobs: nightly archiving of done tasks
- SSE reminder endpoint
- React 19 frontend scaffold with React Query, React Router, shadcn/ui
- GitHub Actions CI: backend tests, frontend tests, E2E with Playwright
- Docker Compose production and dev configurations
```

---

### How to maintain this changelog going forward

1. Every PR that touches user-facing behaviour or security should add an entry to `[Unreleased]`.
2. On each production deployment (`main` merge), rename `[Unreleased]` to the version number and date, and open a new empty `[Unreleased]` block.
3. Use the git log as the source of truth if entries are missed:
   ```bash
   git log --oneline main..DEV
   ```
