# Codebase Concerns

**Analysis Date:** 2026-06-19

> Ground truth = code. Every item below is verified against the actual source.
> The prior spec-drift audit (`docs/audits/spec-drift-2026-05-30.md`) covered 30 doc-vs-code mismatches;
> only findings still present in the current code are listed here, plus new findings from this pass.

---

## Security Considerations

### [HIGH] Access token stored in JS heap (memory) — lost on page refresh, not in httpOnly cookie

**Risk:** The JWT access token is stored only in a module-level JavaScript variable (`let accessToken: string | null = null` in `frontend/src/api/client.ts:3`). On page refresh the token is gone, requiring a silent refresh via cookie on every cold load. This is actually *safer* than localStorage/sessionStorage against XSS, but it means the token transits through `RequireAuth.tsx` on every mount, and if the cookie is ever stolen the attacker can get a fresh 15-minute access token indefinitely.
**Files:** `frontend/src/api/client.ts:3`, `frontend/src/features/auth/RequireAuth.tsx:18-28`
**Current mitigation:** httpOnly cookie with `Secure=true`, `SameSite=lax`, short (15 min) access token lifetime.
**Recommendations:** Design is intentional and reasonable. The gap is that there is no refresh-token rotation (each refresh call issues a new access token but does NOT revoke-and-reissue the refresh token), so a stolen refresh token remains valid for the full 7 days. Add rotation in `backend/app/services/auth_service.py:refresh()`.

---

### [HIGH] SSE endpoint accepts access token via `?token=` query parameter

**Risk:** `frontend/src/api/reminder.ts:13-14` appends the JWT to the SSE URL query string (`?token=encodeURIComponent(token)`). Query parameters appear in server access logs, proxy logs, browser history, and Referrer headers in plain text. If logs are collected by any third-party (Sentry, Datadog, etc.) the token leaks.
**Files:** `frontend/src/api/reminder.ts:11-16`, `backend/app/routers/reminder.py:42-53` (the SSE endpoint uses the standard `get_current_user_id` dependency which reads the `Authorization: Bearer` header — the backend does NOT actually read `?token`).
**Actual code behaviour:** `backend/app/auth/dependencies.py` uses `HTTPBearer()` which reads only the `Authorization` header. The `?token=` param sent by the frontend is silently ignored and the SSE connection will be rejected with 401. This means the SSE stream **cannot currently authenticate** except in the browser when a valid `Authorization` header is somehow supplied (which EventSource cannot do natively).
**Severity:** Critical functional bug masked as a security concern. The SSE stream is broken for unauthenticated EventSource connections that rely on `?token=`; the frontend sends the token in the query string but the backend ignores it.
**Fix:** Either (a) make the backend read `?token` from the SSE endpoint only, with a short TTL, or (b) use a cookie-based auth approach for SSE.

---

### [MEDIUM] No refresh-token table cleanup — unbounded growth

**Risk:** Every login creates a new row in `refresh_tokens`. Logout revokes (sets `revoked=True`) but does NOT delete. There is no scheduler job, migration trigger, or any code path that deletes expired or revoked tokens. Over time this table grows without bound.
**Files:** `backend/app/repositories/user_repository.py:40-70` (no delete method), `backend/app/scheduler/jobs.py` (no cleanup job), `backend/app/services/auth_service.py:60-66`
**Impact:** Table will accumulate one row per login indefinitely. On a multi-user or long-running deployment this is a real storage and query-performance concern. The `get_by_hash` query at `user_repository.py:56` does a full table scan via the unique index — still O(log n) but the table grows forever.
**Fix:** Add a scheduled job (alongside `archive_and_spawn`) that `DELETE FROM refresh_tokens WHERE (revoked = true OR expires_at < now())`. Low urgency for single-user deployment, medium for multi-user.

---

### [MEDIUM] Rate limits are very permissive in default config

**Risk:** `backend/app/config.py:18-20` defaults: `register_rate_limit = "100/minute"`, `login_rate_limit = "100/minute"`, `refresh_rate_limit = "200/minute"`. The comment acknowledges these should be overridden in production but they are not enforced by any deployment checklist or startup validation.
**Files:** `backend/app/config.py:16-20`, `backend/app/limiter.py:6`
**Current mitigation:** Comment says "Override these in production."
**Recommendations:** Add a startup check that logs a WARNING if rate limits are at default values and `ENVIRONMENT == "production"`. Consider tighter defaults (e.g., `5/minute` for login).

---

### [LOW] nginx CSP blocks SSE stream in production (connect-src: 'self')

**Risk:** `frontend/nginx.conf:13` sets `connect-src 'self'`. The SSE URL `createReminderStream()` uses `import.meta.env.VITE_API_BASE_URL` which defaults to `/api/v1` (same-origin). In Docker deployment, API traffic goes through the nginx proxy at `/api/`, so `'self'` is correct. This concern is **not an active bug** in the docker-compose deployment, but it would block SSE if the frontend were ever served from a different origin than the API.
**Files:** `frontend/nginx.conf:13`, `frontend/src/api/reminder.ts:11`
**Severity:** Low — design is currently correct, flag for future if origins split.

---

### [LOW] No HSTS header in nginx config

**Risk:** `frontend/nginx.conf` sets X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy but does NOT set `Strict-Transport-Security`. HTTPS termination happens at Caddy (per `docs/deployment.md`), so Caddy must set HSTS. If the nginx layer is ever exposed directly (bypassing Caddy), HSTS is absent.
**Files:** `frontend/nginx.conf:8-13`
**Recommendations:** Low priority if Caddy always terminates TLS. Document the dependency.

---

## Performance Bottlenecks

### [HIGH] `get_unarchived_done_tasks` is a full cross-user table scan — called daily by scheduler

**Problem:** `backend/app/repositories/task_repository.py:220-227` selects ALL done, non-archived tasks with no `user_id` filter. This is called by `task_service.archive_done_tasks()` at `task_service.py:313`, which is in turn called by the `archive_and_spawn` scheduler job every day at 4am.
**Files:** `backend/app/repositories/task_repository.py:220-227`, `backend/app/services/task_service.py:304-322`, `backend/app/scheduler/jobs.py:51`
**Cause:** The query grows linearly with the total number of done tasks across ALL users. Filtering happens in Python (the `is_task_archivable` loop at `task_service.py:314-317`), not in SQL. Adding `WHERE done_at < $today_4am` to the SQL query would push the filter to the database and make the result set much smaller.
**Improvement path:** Rewrite `get_unarchived_done_tasks` to accept a `cutoff: datetime` parameter and add `WHERE done_at < cutoff` to the SQL query. This converts an O(N_all_done_tasks) Python loop into a targeted index scan.

---

### [HIGH] `batch_reorder_tasks` has N+1 ownership check — one DB round-trip per task ID

**Problem:** `backend/app/services/task_service.py:255-268` iterates each `task_id` in the reorder list, calling `get_by_id()` per item to verify ownership before executing the bulk update. For N tasks in the reorder request, this is N sequential DB round-trips + 1 bulk update.
**Files:** `backend/app/services/task_service.py:261-266`, `backend/app/repositories/task_repository.py:25-35`
**Cause:** Ownership is checked row-by-row in Python instead of in a single `WHERE task_id IN (...) AND user_id = ?` query.
**Improvement path:** Add a `TaskRepository.get_by_ids_for_user(task_ids, user_id)` method that fetches all tasks in one query, then verify the returned count matches the requested count.

---

### [MEDIUM] Missing database indexes — 6 intended indexes never migrated

**Problem:** `docs/database.md` documents 6 performance indexes that do not exist in any migration or in the ORM model. The scheduler's most critical query — `recurring_repository.py:94-100` (`SELECT ... WHERE is_active AND next_run_at <= $now`) — would benefit most from the missing partial index `ix_recurring_next_run`.
**Files:** `backend/alembic/versions/001_initial_schema.py` (creates zero secondary indexes on `tasks` or `recurring_templates`), `backend/app/repositories/recurring_repository.py:92-101`
**Missing indexes (all confirmed absent from migrations and ORM):**
  - `ix_tasks_user_id_due_date` — filters tasks by user + due_date (list endpoint)
  - `ix_tasks_user_id_archived` — filters by user + archived (active/archive split)
  - `ix_tasks_status_archived` — filters by status + archived (scheduler archive job)
  - `ix_tasks_due_date` — due date range scans
  - `ix_task_topics_topic_id` — join table filter by topic
  - `ix_recurring_next_run` — partial index on `recurring_templates(next_run_at) WHERE is_active = true` (scheduler query)
**Real index that DOES exist:** `ix_refresh_tokens_token_hash` (migration 002, also reflected in model).
**Impact:** At small user count these are unnoticeable. As tasks table grows the list endpoint and scheduler job will degrade.
**Improvement path:** Create a new migration `005_performance_indexes.py` adding all six indexes.

---

### [MEDIUM] `archive_and_spawn` scheduler job shares a single session for both sub-jobs; partial failure may leave state inconsistent

**Problem:** `backend/app/scheduler/jobs.py:45-62` opens one `async with session_factory() as session:` and runs archive then spawn inside it. If the archive block succeeds and commits, then the spawn block raises and rolls back, the archive commit already happened (each sub-job has its own `try/except` and calls `await uow.rollback()` on failure). The real risk is the opposite: SQLAlchemy's `AsyncSession` + asyncpg may leave the session in a broken transaction state if the first block fails partially without a rollback, causing the second block to fail too.
**Files:** `backend/app/scheduler/jobs.py:36-62`
**Cause:** Two logically independent operations share one session. The individual `try/except + rollback` guards are present but the interaction between a partially-failed session and subsequent use is subtle.
**Improvement path:** Open two separate sessions (one per sub-job) inside `_archive_and_spawn`. This matches the pattern used by the per-template commits in `RecurringService.create_due_instances()`.

---

### [MEDIUM] `create_due_instances` can spawn unbounded tasks for a long-dormant template

**Problem:** `backend/app/services/recurring_service.py:206-241` loops `while current_run_at <= now` and creates one task per overdue period. A daily template that hasn't run for 365 days will spawn 365 tasks in a single scheduler run — all within one transaction per template (commit at line 240). There is no cap on the number of catch-up instances.
**Files:** `backend/app/services/recurring_service.py:206-242`
**Impact:** Correctness issue that can flood a user's task list and generate high DB write load in one scheduler tick if a template falls far behind (e.g., server downtime).
**Improvement path:** Add a configurable `MAX_CATCHUP_INSTANCES = 7` constant and stop spawning after that limit, logging a warning. Or cap at 1 instance per run (only the most recent overdue period).

---

### [MEDIUM] `RecurringPage.tsx` is 604 lines — approaching the 800-line limit

**File:** `frontend/src/features/recurring/RecurringPage.tsx` (604 lines)
**Note:** No file exceeds 800 lines currently, but `RecurringPage.tsx` is the largest single component and contains inline edit logic, dialogs, popovers, context menus, and formatting helpers all in one file. `TaskRow.tsx` is 484 lines.
**Impact:** High cognitive load for changes; increased merge-conflict surface.
**Improvement path:** Extract the inline edit state machine and the `EditableCell` composition (already imported from `TaskRow.tsx`) into a `RecurringRow.tsx`. Extract format helpers to `frontend/src/lib/recurring.ts`.

---

## Tech Debt

### [HIGH] `window` query parameter is accepted but not validated at the HTTP layer; `TaskFilterParams` Literal is dead code

**What's wrong:** `backend/app/routers/tasks.py:34` declares `window: str | None = Query(None)` — any string passes. The `TaskFilterParams` Pydantic model at `backend/app/schemas/task.py:92-93` defines the correct `Literal["today", "3days", "week", "all"]`, but this schema is never used at the endpoint. Invalid window values are silently ignored (fall through all `if/elif` branches in `task_repository.py:148-169`), returning the same result as `window=None`.
**Files:** `backend/app/routers/tasks.py:34`, `backend/app/schemas/task.py:92-93`, `backend/app/repositories/task_repository.py:148-169`
**Impact:** Clients get no error on typo (`window=toady`); the Literal schema is misleading dead code.
**Fix:** Replace `window: str | None = Query(None)` with `window: Literal["today", "3days", "week", "all"] | None = Query(None)` directly in the router signature.

---

### [MEDIUM] `window=all` is documented but has no implementation — it silently returns default (no window filter)

**What's wrong:** `docs/api-spec.md:73` and `backend/app/schemas/task.py:93` document `"all"` as a valid window value. The repository at `backend/app/repositories/task_repository.py:148-169` has branches for `"today"`, `"3days"`, `"week"` but no `elif window == "all"` branch. `"all"` silently falls through to "no filter applied" — which is functionally the same as `window=None`.
**Files:** `backend/app/repositories/task_repository.py:148-169`, `backend/app/schemas/task.py:93`
**Impact:** The documented `"all"` value works correctly by accident (no filter = all active tasks), but this is undocumented behaviour and could break if logic changes.
**Fix:** Add an explicit `elif window == "all": pass  # no additional filter` branch with a comment, or remove `"all"` from the Literal.

---

### [MEDIUM] `_sync_parent_status` in `SubtaskService` bypasses the status-transition validator

**What's wrong:** `backend/app/services/subtask_service.py:28-50` directly calls `self._uow.tasks.update(task_id, status=TaskStatus.DONE, ...)` when all subtasks are done, and `status=TaskStatus.IN_PROGRESS` when unchecked. This bypasses `validate_status_transition()` in `task_service.py:26-46`. A parent task currently in `TODO` status would transition directly to `DONE` (skipping `IN_PROGRESS`) when all subtasks are marked done — which the transition table at `task_service.py:19-23` explicitly disallows.
**Files:** `backend/app/services/subtask_service.py:36-40`, `backend/app/services/task_service.py:19-23`
**Impact:** Inconsistent business rule enforcement between direct task status update and subtask-driven status update. `TODO → DONE` is a disallowed transition via the main task endpoint but can happen silently via subtask completion.
**Fix:** Either (a) have `_sync_parent_status` call `TaskService.update_task_status()` instead of going direct to the repository, or (b) explicitly allow this specific `TODO → DONE` shortcut in `_VALID_TRANSITIONS` and document it.

---

### [MEDIUM] `PasswordHasher` class is instantiated inside a FastAPI dependency on every request

**What's wrong:** `backend/app/routers/auth.py:22-34` defines `_get_auth_service` as a FastAPI `Depends()` factory that instantiates a new `PasswordHasher` (including constructing a `CryptContext`) on every auth request. `CryptContext` construction is not free.
**Files:** `backend/app/routers/auth.py:22-34`
**Impact:** Minor — bcrypt's CryptContext construction is cheap compared to the bcrypt hash itself. But it is unnecessarily recreated on every request.
**Fix:** Move `PasswordHasher` and `_ctx = CryptContext(...)` to module level (construct once at import time).

---

### [LOW] Subtask status is `TaskStatus` (sharing the same DB enum as tasks) with no `IN_PROGRESS` semantic

**What's wrong:** `backend/app/models/subtask.py` reuses the `taskstatus` PostgreSQL enum (`todo`, `in_progress`, `done`) for subtasks. Subtasks are only ever `todo` or `done` in practice; `in_progress` is a valid DB value but has no defined meaning for a subtask and is never set by any code path.
**Files:** `backend/app/models/subtask.py`, `backend/alembic/versions/004_subtasks.py:22`
**Impact:** Low — no current bug, but the schema allows a state with undefined semantics, which may confuse future contributors.

---

### [LOW] `window=today` includes tasks with `due_date IS NULL` (floating tasks) but `window=3days`/`week` exclude them

**What's wrong:** `backend/app/repositories/task_repository.py:149-156` — `today` explicitly includes `OR Task.due_date.is_(None)` (floating tasks). `3days` and `week` at lines 158-169 add `Task.due_date.isnot(None)` which excludes floating tasks. This asymmetry is implicit and undocumented.
**Files:** `backend/app/repositories/task_repository.py:149-169`
**Impact:** Clients using `window=3days` will not see floating (no-due-date) tasks, which may be surprising. The frontend may surface this as "tasks disappearing" depending on the filter selected.
**Fix:** Document the asymmetry explicitly in the repo method docstring, or align behaviour (include floating tasks in all windows or none).

---

## Fragile Areas

### [HIGH] SSE cleanup relies on `finally` block — generator teardown depends on client disconnect detection

**What's fragile:** `backend/app/routers/reminder.py:59-84` — the `event_generator` async generator cleans up via `finally: sse_manager.remove_connection(user_id, queue)`. This only runs when the generator is fully exhausted or an exception propagates. If a client disconnects abruptly (TCP reset, proxy timeout, mobile network drop) and `request.is_disconnected()` at line 69 is not polled promptly, the queue and connection registration can leak until the next loop iteration (up to 30s keep-alive timeout). The `sse_manager` singleton at `backend/app/sse/connection_manager.py:51` stores queues in a process-local dict — no persistence, no size cap.
**Files:** `backend/app/routers/reminder.py:59-84`, `backend/app/sse/connection_manager.py:11-52`
**Safe modification:** The `remove_connection` in the `finally` block does work correctly on normal disconnect; the 30-second keep-alive loop means stale connections clear within one timeout cycle. Risk increases under high concurrency (many open SSE connections per user).

---

### [MEDIUM] `update_task` in `TaskRepository` accepts arbitrary `**fields` passed directly to SQLAlchemy `update().values(**fields)` — no field allowlist

**What's fragile:** `backend/app/repositories/task_repository.py:73-90` takes `**fields` and passes them verbatim to `update(Task).values(**fields)`. The caller (service layer) is responsible for only passing valid column names. A programming error in a service method that passes an unknown key would raise a runtime SQLAlchemy error rather than being caught at the model boundary.
**Files:** `backend/app/repositories/task_repository.py:73-90`, `backend/app/services/task_service.py:182` (caller)
**Safe modification:** Low risk in current codebase since all callers are controlled. Risk increases if new service methods are added without care.

---

### [MEDIUM] Frontend fallback polling silently degrades to 60s intervals with no user indication

**What's fragile:** `frontend/src/hooks/useReminder.ts:22-31` — after 3 failed SSE reconnects, the hook switches to 60-second HTTP polling (`FALLBACK_POLL_MS = 60_000`). There is no state exposed to the UI indicating degraded mode. The `ReminderBanner` component will appear to work normally but with 60s staleness instead of near-real-time updates.
**Files:** `frontend/src/hooks/useReminder.ts:15-31`, `frontend/src/features/reminder/ReminderBanner.tsx`
**Impact:** Silent degradation. If SSE is broken in production (misconfigured proxy buffer, nginx without `proxy_buffering off`), users get stale reminders and no indication.

---

## Missing Tests / Low-Coverage Areas

### [HIGH] No integration tests for subtask endpoints

**What's not tested:** `backend/tests/integration/` has `test_tasks.py`, `test_recurring.py`, `test_topics.py`, `test_auth.py` but no `test_subtasks.py`. The subtask CRUD endpoints at `backend/app/routers/subtasks.py` have zero integration test coverage. The `_sync_parent_status` side-effect (subtask completion changing parent task status) has no end-to-end test.
**Files:** `backend/app/routers/subtasks.py`, `backend/app/services/subtask_service.py`
**Risk:** The `TODO → DONE` bypass described in the Tech Debt section above is particularly risky with no integration test to catch it.
**Priority:** High

---

### [HIGH] No integration tests for archive/restore endpoints

**What's not tested:** `backend/tests/integration/` has no `test_archive.py`. `backend/app/routers/archive.py` endpoints (`GET /archive`, `POST /archive/{task_id}/restore`) have no integration test coverage.
**Files:** `backend/app/routers/archive.py`, `backend/app/services/archive_service.py`
**Priority:** High

---

### [MEDIUM] No integration tests for bulk-delete or batch-reorder task endpoints

**What's not tested:** `test_tasks.py` does not include tests for `POST /tasks/bulk-delete` or `POST /tasks/reorder`. These are complex paths with ownership checks and partial failure semantics.
**Files:** `backend/app/routers/tasks.py:72-79, 145-153`, `backend/app/services/task_service.py:255-298`
**Priority:** Medium

---

### [MEDIUM] Frontend tests cover only API module layer — no component tests for any feature page

**What's not tested:** All 10 frontend unit test files in `frontend/src/` are API-layer tests (`*.test.ts` files in `src/api/`), type tests, or utility tests. There are no component-level unit or integration tests for `TaskListPage`, `TaskRow`, `RecurringPage`, `ReminderBanner`, `RequireAuth`, or any auth flows. Coverage for frontend business logic (e.g., `nextStatus()` cycling in `TaskRow.tsx:19-23`) has no unit test.
**Files:** `frontend/src/features/` (no `*.test.tsx` files anywhere)
**Priority:** Medium — E2E Playwright tests do exist and provide some coverage.

---

### [LOW] `useReminder` hook has no unit test

**What's not tested:** `frontend/src/hooks/useReminder.ts` — the SSE reconnection logic, fallback polling activation, and cleanup on unmount are complex and have no test. `frontend/src/api/reminder.test.ts` (66 lines) tests only the API helper functions.
**Files:** `frontend/src/hooks/useReminder.ts`
**Priority:** Low

---

## Documentation Drift

> Source: `docs/audits/spec-drift-2026-05-30.md`. Re-verified below against current code.
> All 30 findings from that audit remain unresolved — the audit explicitly states "No spec or code changes were made."
> Below lists the highest-impact drifts that affect development decisions.

### [HIGH] `docs/database.md` — "Key Indexes" section is entirely fictional

**Doc:** `docs/database.md:97-119` lists six indexes as existing.
**Code:** `backend/alembic/versions/001_initial_schema.py` creates zero secondary indexes on `tasks` or `recurring_templates`. `backend/alembic/versions/002_index_refresh_token_hash.py` creates the one real index (`ix_refresh_tokens_token_hash`) which is NOT listed in the doc.
**Impact:** Anyone relying on `docs/database.md` for performance reasoning will be wrong about what indexes exist. The missing partial index on `recurring_templates(next_run_at)` was specifically described as supporting the scheduler query.

---

### [HIGH] `docs/api-spec.md` — "All responses use this envelope" claim is false for 401, 422, 429, and health

**Doc:** `docs/api-spec.md:34` states "All responses use this envelope: `{ success, data, error, meta }`"
**Code:** `backend/app/main.py:74` — `RateLimitExceeded` returns slowapi's bare 429 body; `backend/app/middleware/error_handler.py` handles AppError/LookupError/PermissionError with the envelope, but `HTTPException(401)` from `backend/app/auth/dependencies.py:31` returns FastAPI's default `{"detail": ...}` format. No `RequestValidationError` handler means 422s return `{"detail": [...objects]}`.
**Impact:** Clients implementing a universal response parser based on the doc will break on auth errors and validation failures.

---

### [HIGH] `docs/api-spec.md` — Scheduled jobs table is wrong on job names and count

**Doc:** `docs/api-spec.md:149-150` lists `archive_done_tasks` and `create_recurring_instances` as separate jobs.
**Code:** `backend/app/scheduler/jobs.py:72-77` registers exactly three jobs: `archive_and_spawn` (combined), `push_reminder_at_6pm`, `push_reminder_at_1am`. Neither documented job name exists. The method called is `create_due_instances` not `create_recurring_instances`.
**Impact:** Anyone debugging scheduler behaviour using the doc will look for jobs that don't exist.

---

### [MEDIUM] `docs/frontend-spec.md` — SSE section is incorrect on reconnection strategy and auth

**Doc:** `docs/frontend-spec.md:56` states "browser EventSource retries with backoff"; line 53 states "no polling"; auth transport undocumented.
**Code:** `frontend/src/hooks/useReminder.ts:50-67` — custom exponential backoff, closes and reopens EventSource; polling fallback activates after 3 failures. `frontend/src/api/reminder.ts:13-14` sends `?token=` in query param (which the backend ignores — see SSE auth bug above).
**Impact:** Debugging SSE connectivity with the doc as reference will mislead developers.

---

### [MEDIUM] `docs/api-spec.md` — Environment Variables block omits 8 real settings

**Doc:** `docs/api-spec.md:173-182` lists `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`.
**Code:** `backend/app/config.py` has additional: `TEST_DATABASE_URL`, `ALLOWED_ORIGINS`, `RATE_LIMIT_ENABLED`, `REGISTER_RATE_LIMIT`, `LOGIN_RATE_LIMIT`, `REFRESH_RATE_LIMIT`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`, `LOG_LEVEL`, `LOG_FILE`, `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `ENVIRONMENT`.
**Impact:** Deployers following the doc will not configure observability, rate limiting, or CORS correctly.

---

*Concerns audit: 2026-06-19*
