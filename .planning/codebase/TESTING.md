# Testing Patterns

**Analysis Date:** 2026-06-19

## Test Framework Overview

| Layer | Framework | Config | Location |
|-------|-----------|--------|----------|
| Backend unit | pytest 8.3.4 + pytest-asyncio 0.24.0 | `backend/pytest.ini` | `backend/tests/unit/` |
| Backend integration | pytest (same) | `backend/pytest.ini` | `backend/tests/integration/` |
| Backend coverage | pytest-cov 6.0.0 | CI flag `--cov=app --cov-fail-under=80` | — |
| Frontend unit | Vitest 4.0.18 | `frontend/vite.config.ts` `test:` block | `frontend/src/` (co-located) |
| Frontend coverage | @vitest/coverage-v8 4.0.18 | `vite.config.ts` coverage block | — |
| Frontend E2E | Playwright 1.58.2 + Chromium only | `frontend/playwright.config.ts` | `frontend/e2e/` |

## Backend Tests

### Configuration (`backend/pytest.ini`)

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
pythonpath = .
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = --tb=short -v
```

`asyncio_mode = auto` means all `async def test_*` functions run as coroutines automatically — no `@pytest.mark.asyncio` required at file level, though it appears on individual methods for explicitness.

### Run Commands

```bash
# All tests (from backend/)
cd backend && pytest tests/ -v --cov=app

# With coverage threshold enforcement (as in CI)
pytest --cov=app --cov-fail-under=80 --ignore=tests/integration/test_migrations.py tests/

# Migration check only (separate CI step)
pytest tests/integration/test_migrations.py -v

# Single test file
pytest tests/unit/test_task_service.py -v

# Single test class
pytest tests/unit/test_task_service.py::TestValidateStatusTransition -v
```

Required environment variables for integration tests:

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/todoapp_test
TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/todoapp_test
SECRET_KEY=<any-value>
```

### Test File Organization

```
backend/tests/
├── conftest.py              # All shared fixtures (db_session, client, auth_headers)
├── __init__.py
├── unit/
│   ├── __init__.py
│   ├── test_archive_service.py
│   ├── test_auth_service.py
│   ├── test_recurring_service.py
│   ├── test_reminder_service.py
│   ├── test_task_service.py
│   └── test_topic_service.py
└── integration/
    ├── __init__.py
    ├── test_auth.py
    ├── test_migrations.py
    ├── test_recurring.py
    ├── test_tasks.py
    └── test_topics.py
```

**One test file per service/router.** File names match the module under test: `test_task_service.py` tests `app/services/task_service.py`; `test_tasks.py` tests `app/routers/tasks.py`.

### Test Structure

Tests are grouped in `Test*` classes by method/behavior being tested. Each class is focused on one logical unit:

```python
# backend/tests/unit/test_task_service.py
class TestValidateStatusTransition:
    """Pure function — no DB needed."""
    def test_todo_to_in_progress_is_valid(self): ...
    def test_done_to_in_progress_is_invalid(self): ...

class TestTaskServiceUpdateStatus:
    """Tests for TaskService.update_task_status with mocked UnitOfWork."""
    @pytest.mark.asyncio
    async def test_update_status_todo_to_in_progress(self): ...

class TestTaskServiceCreateTask:
    """Tests for TaskService.create_task."""
    @pytest.mark.asyncio
    async def test_create_task_minimal(self): ...
```

Pure synchronous helper functions (no DB, no async) use plain `def test_*` methods. Service methods that are async use `async def test_*` with `@pytest.mark.asyncio`.

### Fixtures (`backend/tests/conftest.py`)

All shared fixtures live in a single `conftest.py`. Unit tests do not use any of the DB fixtures — they simply do not request them, so the DB is never created for unit tests.

**`test_engine` (scope=`session`):** Creates the full DB schema once using `asyncio.run()` (not `async` fixture, to avoid pytest-asyncio event-loop scope issues at session level). Drops schema on teardown.

**`db_session` (scope=`function`, async):** Provides a fresh `AsyncSession`. Teardown deletes all rows in reverse FK order — schema is preserved between tests for speed.

**`client` (async):** `httpx.AsyncClient` wrapping the FastAPI app with `ASGITransport`. Overrides `get_db` dependency to inject the test session:

```python
# backend/tests/conftest.py
@pytest.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

**`auth_headers` (async):** Registers a UUID-email throwaway user, logs in, returns `{"Authorization": "Bearer <token>"}`:

```python
@pytest.fixture
async def auth_headers(client):
    email = f"test-{uuid.uuid4()}@example.com"
    reg = await client.post("/api/v1/auth/register", ...)
    login = await client.post("/api/v1/auth/login", ...)
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### Mocking Patterns (Unit Tests)

Unit tests mock the `UnitOfWork` and individual repository methods using `unittest.mock.AsyncMock`. No DB connection is established.

**Factory helpers** create minimal mock objects:

```python
# backend/tests/unit/test_task_service.py
def _make_task(status=TaskStatus.TODO, done_at=None, ...) -> Task:
    task = Task()
    task.id = uuid.uuid4()
    # ... set attributes directly
    return task

def _make_uow(task_repo: AsyncMock) -> AsyncMock:
    mock_uow = AsyncMock()
    mock_uow.tasks = task_repo
    mock_uow.commit = AsyncMock()
    mock_uow.rollback = AsyncMock()
    return mock_uow
```

**Service instantiation with mocked UoW:**

```python
mock_repo = AsyncMock()
mock_repo.get_by_id.return_value = task
mock_uow = _make_uow(mock_repo)
service = TaskService(uow=mock_uow, sse_manager=None)
```

`auth_service.py` tests also mock `passlib` password verification using `unittest.mock.patch`.

### Integration Test Pattern

Integration tests use `client` + `auth_headers` fixtures. They exercise the full HTTP → router → service → real PostgreSQL stack:

```python
# backend/tests/integration/test_tasks.py
class TestTaskCreate:
    @pytest.mark.asyncio
    async def test_create_task_returns_201(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Buy groceries"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["title"] == "Buy groceries"
```

**Multi-user isolation:** Some integration tests register a second user inline with a helper:

```python
async def _make_headers(client, email) -> dict:
    """Register a new user and return auth headers."""
    ...
```

### Coverage

- **Threshold:** 80% line coverage on `app/` (`--cov=app --cov-fail-under=80`)
- **Migration tests excluded** from coverage run (separate CI step)
- **Coverage report:** `--tb=short` on failure; no HTML report generated in CI (terminal only)

## Frontend Tests

### Configuration (`frontend/vite.config.ts`, `test:` section)

```typescript
test: {
  globals: true,
  environment: 'node',
  exclude: ['e2e/**', 'node_modules/**'],
  coverage: {
    provider: 'v8',
    include: ['src/lib/**', 'src/api/**'],
    exclude: ['src/api/client.ts'],
    thresholds: {
      lines: 80,
    },
  },
},
```

Key points:
- **`globals: true`**: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` are global — no imports needed in test files (though some files still import them explicitly).
- **`environment: 'node'`**: Tests run in Node.js, not jsdom. There is no DOM simulation — component rendering tests are not present.
- **Coverage scope:** Only `src/lib/**` and `src/api/**` are included. Components, hooks, features, and types are **excluded from coverage**. The 80% threshold applies only to this narrow scope.
- **`src/api/client.ts` excluded** from coverage (Axios instance setup, difficult to test in isolation).

### Run Commands

```bash
# From frontend/
npm test                          # vitest run (one-shot, no watch)
npm run test:coverage             # vitest run --coverage
npx vitest run --coverage --coverage.thresholds.lines=80   # as in CI

# E2E (requires running stack)
npm run test:e2e                  # playwright test
npm run test:e2e:ui               # playwright test --ui (headed)
npm run test:e2e:report           # playwright show-report
```

### Test File Organization

Frontend unit tests are **co-located** with the source files they test:

```
frontend/src/
├── api/
│   ├── client.ts
│   ├── client.test.ts          # tests token management
│   ├── tasks.ts
│   ├── tasks.test.ts           # tests API function call signatures
│   ├── auth.test.ts
│   ├── topics.test.ts
│   ├── archive.test.ts
│   ├── recurring.test.ts
│   └── reminder.test.ts
├── lib/
│   ├── utils.ts
│   └── utils.test.ts           # tests cn() utility
├── types/
│   ├── task.ts
│   └── task.test.ts            # compile-time type shape tests
└── features/
    └── recurring/
        ├── RecurringPage.tsx
        └── RecurringPage.test.ts  # pure helper logic tests
```

E2E tests are in a separate top-level directory:

```
frontend/e2e/
├── helpers.ts                  # shared page-object helpers (uid, registerAndLogin, createTask)
├── auth.spec.ts
├── tasks.spec.ts
├── topics.spec.ts
├── recurring.spec.ts
├── status.spec.ts
```

### Frontend Test Structure

```typescript
// Pattern from frontend/src/api/tasks.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
}))

import client from './client'
import { getTasks } from './tasks'

describe('tasks api', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('getTasks calls GET /tasks', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getTasks()
    expect(client.get).toHaveBeenCalledWith('/tasks', { params: undefined })
  })
})
```

**`afterEach` cleanup** for stateful tests:

```typescript
// frontend/src/api/client.test.ts
afterEach(() => { setAccessToken(null) })
```

### Mocking (Frontend)

**Only the Axios client module is mocked.** All `api/*.test.ts` tests mock `./client` at the module level with `vi.mock()`:

```typescript
vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
}))
```

After mocking, `vi.mocked(client.get).mockResolvedValue(...)` sets per-test return values.

**No MSW (Mock Service Worker)** is used. The frontend API tests verify that functions call the correct Axios method with the correct URL and payload — they are contract tests against the Axios client, not HTTP tests.

**Type tests** (`frontend/src/types/task.test.ts`) construct full `Task` objects at compile time to verify interface shape — they are pure TypeScript compile-time checks wrapped in runtime assertions:

```typescript
it('includes recurring_template_id field', () => {
  const task: Task = { id: 'abc', title: 'Test', ..., recurring_template_id: null }
  expect(task.recurring_template_id).toBeNull()
})
```

### Frontend Coverage

Coverage scope (`vite.config.ts`):
- **Included:** `src/lib/**`, `src/api/**`
- **Excluded:** `src/api/client.ts` (Axios setup)
- **Threshold:** 80% line coverage
- **Provider:** v8

This means component files, hook files, feature pages, and type definitions are **not required to meet the threshold** — coverage is enforced only for utility functions and API wrapper functions.

## E2E Tests (Playwright)

### Configuration (`frontend/playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // sequential — tests share a single DB instance
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

Key constraints:
- **Sequential only** (`workers: 1`, `fullyParallel: false`) — all specs share one DB.
- **Chromium only** — no cross-browser matrix.
- **`baseURL`:** Defaults to `http://localhost:5173` (Vite dev server). CI overrides to `http://localhost:8080` (Docker nginx container via `PLAYWRIGHT_BASE_URL`).
- **Trace on first retry**, screenshot on failure, video off.
- **CI assertion timeout:** 15 s (vs 5 s locally).

### E2E Test Structure

Each spec file covers one feature domain. Tests use `test.describe` + `test.beforeEach` for setup:

```typescript
// frontend/e2e/tasks.spec.ts
import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

test.describe('Task CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `tasks-${uid()}@example.com`, 'password123')
  })

  test('create a task', async ({ page }) => {
    const title = `My Task ${uid()}`
    await createTask(page, title)
    await expect(page.getByText(title)).toBeVisible()
  })
})
```

**Data isolation:** Each `beforeEach` registers a fresh user with a `uid()` suffix (timestamp + random). Tests are isolated from each other without DB teardown between tests.

### E2E Helpers (`frontend/e2e/helpers.ts`)

Reusable page-interaction helpers encapsulate common flows:

```typescript
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function registerAndLogin(page: Page, email: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  // ...
  await page.waitForURL('**/')
}

export async function createTask(page: Page, title: string) {
  await openCreateTaskDrawer(page)
  await page.getByLabel('Title *').fill(title)
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText(title)).toBeVisible()
}
```

**Locator strategy:** `getByRole` and `getByLabel` are the primary selectors — no CSS selectors or `nth-child` patterns in helpers. Inline tests use `page.locator('tbody tr', { hasText: title })` for row scoping.

**No `waitForTimeout`** — all waits use observable state (`waitForURL`, `toBeVisible`, `toBeHidden`).

## CI Test Jobs (`.github/workflows/ci.yml`)

### Backend job (`backend` → `ubuntu-latest`)

1. Spins up `postgres:16-alpine` service
2. Installs Python 3.12 dependencies from `backend/requirements.txt`
3. **Migration check:** `pytest tests/integration/test_migrations.py -v`
4. **Full test run with coverage:** `pytest --cov=app --cov-fail-under=80 --ignore=tests/integration/test_migrations.py tests/`
5. Fails if coverage drops below 80%

### Frontend job (`frontend` → `ubuntu-latest`)

1. Installs Node 20, runs `npm ci`
2. **Type check:** `npx tsc --noEmit`
3. **Vitest with coverage:** `npx vitest run --coverage --coverage.thresholds.lines=80`
4. No ESLint step in CI

### E2E job (`e2e` → `ubuntu-latest`, depends on `docker-build`)

1. Starts `docker compose up -d --build` (full stack)
2. Polls `http://localhost:8080` until ready (60 s timeout)
3. Installs Playwright + Chromium: `npx playwright install --with-deps chromium`
4. Runs: `npm run test:e2e` with `PLAYWRIGHT_BASE_URL=http://localhost:8080`
5. Uploads `frontend/playwright-report/` as artifact on failure (7-day retention)

### Coverage Thresholds (Actual Enforced Values)

| Layer | Scope | Threshold | Enforcement |
|-------|-------|-----------|-------------|
| Backend | `app/` (all Python) | 80% line | `--cov-fail-under=80` in CI |
| Frontend | `src/lib/**` + `src/api/**` (excl. `client.ts`) | 80% line | `coverage.thresholds.lines=80` in CI |
| Frontend components/hooks/features | Not measured | None | — |

---

*Testing analysis: 2026-06-19*
