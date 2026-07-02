# Coding Conventions

**Analysis Date:** 2026-06-19

## Formatters & Linters

### Backend (Python)

No `pyproject.toml` or `ruff.toml` is present in `backend/`. The project rules prescribe **black**, **isort**, and **ruff**, but no formatter/linter config file is checked in — they are not wired into CI (the `ci.yml` backend job runs only `pytest`). The actual enforcement gate is the pytest run itself; type-checking and formatting are developer-local only.

- **Formatter:** black (prescribed, not CI-enforced)
- **Import sorter:** isort (prescribed, not CI-enforced)
- **Linter:** ruff (prescribed, not CI-enforced)

### Frontend (TypeScript)

ESLint is configured and available via `npm run lint`, but it is **not in the CI pipeline** (the `frontend` CI job runs `tsc --noEmit` and Vitest, not `eslint`). Prettier is not configured.

- **Linter:** ESLint 9.39.1, flat config at `frontend/eslint.config.js`
  - Extends: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `eslint-plugin-react-refresh` (Vite preset)
  - Scope: all `**/*.{ts,tsx}` files, excluding `dist/`
  - `ecmaVersion: 2020`, `globals: browser`
- **Formatter:** none configured (no Prettier or Biome)
- **Type checker:** `tsc --noEmit` (runs in CI via `npx tsc --noEmit` in `frontend/`)
  - TypeScript strict mode enabled: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`

## Naming Patterns

### Backend

**Files:** `snake_case` throughout — `task_service.py`, `task_repository.py`, `error_handler.py`.

**Modules/directories:** `snake_case` — `app/routers/`, `app/repositories/`, `app/schemas/`, `app/services/`, `app/middleware/`, `app/models/`.

**Classes:** `PascalCase` — `TaskRepository`, `TaskService`, `ApiResponse`, `AppError`, `AccessLogMiddleware`.

**Functions & methods:** `snake_case` — `validate_status_transition`, `get_current_user_id`, `global_exception_handler`.

**Variables & parameters:** `snake_case` — `user_id`, `task_id`, `today_4am`, `hashed_password`.

**Constants:** `UPPER_SNAKE_CASE` — `_VALID_TRANSITIONS` (module-private prefix `_`), `_SKIP_PATHS`.

**Pydantic schemas:** suffix with `Request`/`Response`/`Params`:
- `TaskCreateRequest`, `TaskUpdateRequest`, `TaskStatusUpdateRequest` (`backend/app/schemas/task.py`)
- `TaskResponse`, `ApiResponse[T]` (`backend/app/schemas/common.py`)
- `TaskFilterParams` (`backend/app/schemas/task.py`)

**SQLAlchemy models:** plain `PascalCase`, match the domain noun — `Task`, `Topic`, `User`.

**Enums:** `PascalCase` class, `UPPER_SNAKE_CASE` members with lowercase string values:
```python
# backend/app/models/task.py
class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
```

### Frontend

**Files:** `PascalCase` for React components (`TaskRow.tsx`, `TaskListPage.tsx`), `camelCase` for non-component modules (`client.ts`, `useTasks.ts`, `utils.ts`).

**Directories:** `camelCase` feature folders (`features/tasks/`, `features/auth/`), `camelCase` for hooks (`hooks/`), `api/`, `types/`, `lib/`, `components/`.

**Interfaces & types:** `PascalCase` — `Task`, `ApiResponse<T>`, `TaskCreatePayload`, `TaskFilterParams`.

**Type aliases:** `PascalCase` — `TaskStatus = 'todo' | 'in_progress' | 'done'`, `TaskFilterWindow`.

**Functions & hooks:** `camelCase` — `getTasks`, `createTask`, `useTasks`, `useCreateTask`.

**Constants:** `UPPER_SNAKE_CASE` — `TASKS_QUERY_KEY = 'tasks'` (`frontend/src/hooks/useTasks.ts`).

**React components:** `PascalCase` function declarations — `function TaskRow(...)`, `function TaskListPage(...)`.

## Type Annotations

### Backend

All function signatures carry full type annotations. Repository methods annotate parameters and return types explicitly:

```python
# backend/app/repositories/task_repository.py
async def get_by_id(self, task_id: uuid.UUID) -> Task | None:
```

Service-layer pure helpers also fully annotated:

```python
# backend/app/services/task_service.py
def validate_status_transition(current: TaskStatus, new: TaskStatus) -> None:
def is_task_archivable(task: Task, today_4am: datetime) -> bool:
```

Union types use `X | Y` syntax (Python 3.10+ style), not `Optional[X]` or `Union[X, Y]`.

Pydantic `BaseModel` subclasses rely on field annotations for schema derivation — no explicit `Field()` unless adding constraints:

```python
# backend/app/schemas/task.py
class TaskBatchReorderRequest(BaseModel):
    tasks: list[TaskBatchReorderItem] = Field(..., min_length=1, max_length=50)
```

### Frontend

TypeScript strict mode is on. Props and function signatures carry explicit types. `interface` is used for object shapes; `type` for unions and aliases:

```typescript
// frontend/src/types/task.ts
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export interface Task { ... }
export interface TaskCreatePayload { ... }
```

API functions are explicitly typed with generics:

```typescript
// frontend/src/api/tasks.ts
export async function getTasks(params?: TaskFilterParams): Promise<ApiResponse<Task[]>>
```

`import type` is used for type-only imports (enforced by `verbatimModuleSyntax: true` in `frontend/tsconfig.app.json`).

## Import Organization

### Backend

Standard Python import order (PEP 8 / isort):
1. Standard library (`import uuid`, `from datetime import datetime`)
2. Third-party (`from fastapi import ...`, `from pydantic import ...`, `from sqlalchemy import ...`)
3. Local app imports (`from app.models.task import Task`, `from app.services.task_service import TaskService`)

Module-level `# noqa: F401` comments are used intentionally to register SQLAlchemy relationships without direct usage:

```python
# backend/app/repositories/task_repository.py
from app.models.recurring import RecurringInstance  # noqa: F401 — registers relationship
```

### Frontend

Path alias `@` resolves to `frontend/src/` (configured in `vite.config.ts` and `tsconfig.app.json`). Import order in practice:

1. Third-party (`import { useMutation, useQuery } from '@tanstack/react-query'`)
2. Internal types via alias (`import type { ApiResponse } from '@/types/api'`)
3. Internal modules via alias (`import { getTasks } from '@/api/tasks'`)

`import type` is used consistently for TypeScript-only imports in `frontend/src/api/` and `frontend/src/hooks/`.

## API Response Envelope

Both backend and frontend share a single canonical response shape.

**Backend** (`backend/app/schemas/common.py`):
```python
class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None
    error: str | None = None
    meta: PaginationMeta | None = None

    @classmethod
    def ok(cls, data: T, meta: PaginationMeta | None = None) -> "ApiResponse[T]": ...
    @classmethod
    def fail(cls, error: str) -> "ApiResponse[None]": ...
```

Routers always use `ApiResponse.ok(...)` for success, never construct the dict manually. Error handlers construct the same shape as a plain dict (for middleware-level responses without schema overhead).

**Frontend** (`frontend/src/types/api.ts`):
```typescript
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  meta?: PaginationMeta
}
```

## Immutability Patterns

### Backend

Pydantic models are **immutable by default** (Pydantic v2 `BaseModel` does not allow attribute mutation). No `@dataclass(frozen=True)` usage observed in the service layer — domain data flows through Pydantic schemas rather than frozen dataclasses.

SQLAlchemy ORM objects are **mutated in-place** inside service methods (e.g., setting `task.status`, `task.done_at`) before flushing — this is the standard SQLAlchemy pattern and is not considered a violation of the immutability principle for ORM entities.

Update operations on repositories use keyword-argument style (no object mutation at the call site):

```python
# backend/app/services/task_service.py (pattern)
await uow.tasks.update(task.id, status=new_status, done_at=now)
```

### Frontend

React state is never mutated directly. TanStack Query handles cache updates via `queryClient.invalidateQueries` after mutations (optimistic update is not used — `onSuccess` invalidates and re-fetches):

```typescript
// frontend/src/hooks/useTasks.ts
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
},
```

## Error Handling

### Backend

**Exception hierarchy** (`backend/app/exceptions.py`):
- `AppError(ValueError)` — intentional business-rule violations. Only `AppError` messages are user-safe.
- Standard `LookupError` — resource not found.
- Standard `PermissionError` — ownership checks.
- Plain `ValueError` from third-party code — falls to the catch-all 500 handler.

**Exception → HTTP mapping** (`backend/app/main.py`, `backend/app/middleware/error_handler.py`):

| Exception | HTTP Status | Message shown to client |
|-----------|-------------|------------------------|
| `AppError` | 400 | `str(exc)` (safe user message) |
| `LookupError` | 404 | "Resource not found" |
| `PermissionError` | 403 | "Not authorized" |
| `Exception` (catch-all) | 500 | "An internal server error occurred" |

All error responses use the same envelope: `{"success": false, "data": null, "error": "<message>"}`.

The 500 handler **logs** the full exception via `logger.exception(...)` with structured context (method, path, request_id, user_id) before returning the generic message. Internal stack traces never reach the client.

### Frontend

API functions return `ApiResponse<T>` and callers check `response.success`. No global try/catch wrapper around Axios calls — error surfacing is handled by TanStack Query's `isError` state and the `sonner` toast library for user notifications.

## Logging

### Backend

Structured JSON logging via `python-json-logger` (`backend/app/logging_config.py`). One log line per event, written to stderr (and optionally a file via `LOG_FILE` env var).

Pattern in all services:
```python
import logging
logger = logging.getLogger(__name__)
# Usage:
logger.info("event.name", extra={"key": "value"})
logger.exception("http.error", extra={...})
```

Event names use dot-separated lowercase identifiers (`"http.request"`, `"user.login"`). PII / tokens are never logged. `user_id` is logged as a string UUID when present.

The access log middleware (`backend/app/middleware/access_log.py`) emits one `"http.request"` line per response, skipping `/api/health`.

### Frontend

No logging framework. `console.*` is not expected in production paths (TypeScript ESLint would flag it).

## Validation

### Backend

All request validation is done via Pydantic v2 `BaseModel` at the router boundary (FastAPI injects and validates automatically). Validators use `@field_validator` with `@classmethod`:

```python
# backend/app/schemas/task.py
@field_validator("title")
@classmethod
def title_not_empty(cls, v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Title must not be empty")
    if len(v) > 255:
        raise ValueError("Title must not exceed 255 characters")
    return v
```

Pydantic validation failures automatically return HTTP 422 (handled by FastAPI's default `RequestValidationError` handler). Business-rule validation inside services raises `AppError` (→ 400).

Settings are validated at startup via `pydantic-settings` `BaseSettings` (`backend/app/config.py`) — missing `SECRET_KEY` causes a hard failure at startup.

### Frontend

No runtime schema validation library (no Zod). Type safety is compile-time only via TypeScript. The backend is the authority for validation; the frontend does not re-validate input beyond HTML form constraints.

## Comments

**Backend:** Modules have docstrings explaining purpose and key design decisions. Functions have docstrings only when behavior is non-obvious. Inline comments explain `# noqa` suppression and SQLAlchemy relationship registration.

**Frontend:** JSDoc-style block comments appear at the top of test files explaining covered behaviors. Inline comments explain non-obvious UI interactions (e.g., portal rendering in E2E tests).

No JSDoc on regular TypeScript functions — TypeScript types are the self-documentation.

## Module Design

### Backend

Each router file (`backend/app/routers/`) exports a single `APIRouter` instance bound to a resource prefix. Service classes are instantiated per-request via FastAPI `Depends`. Repository classes take a `session: AsyncSession` in `__init__` and are created by the Unit of Work.

### Frontend

Each `api/` module exports named async functions (no default export for API modules). Hooks (`hooks/`) export named `use*` functions that wrap TanStack Query calls. Types are in `types/` with named exports; no barrel files (`index.ts` re-exports) are used.

---

*Convention analysis: 2026-06-19*
