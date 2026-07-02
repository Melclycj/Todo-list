# Technology Stack

**Analysis Date:** 2026-06-19

## Languages

**Primary:**
- Python 3.12 — backend (confirmed in `backend/Dockerfile`: `FROM python:3.12-slim`)
- TypeScript 5.9 — frontend (`frontend/package.json`: `"typescript": "~5.9.3"`)

**Secondary:**
- SQL — PostgreSQL DDL in Alembic migration files (`backend/alembic/versions/`)
- HTML/CSS — frontend template (`frontend/index.html`, `frontend/src/index.css`)

## Runtime

**Backend Environment:**
- Python 3.12 (slim Docker image)
- Uvicorn 0.32.1 — ASGI server (`backend/requirements.txt`)
- Asyncio event loop — all I/O is async (`backend/app/database.py`)

**Frontend Environment:**
- Node 22 (build stage, `frontend/Dockerfile`: `FROM node:22-alpine AS builder`)
- Node 20 used in CI (`ci.yml`: `node-version: "20"`)
- Nginx 1.27-alpine — serves production build and proxies `/api/*` to FastAPI (`frontend/Dockerfile`, `frontend/nginx.conf`)

**Package Manager:**
- Backend: `pip` with `requirements.txt` (no `pyproject.toml`)
- Frontend: `npm` with `package-lock.json` (lockfile committed)

## Frameworks

**Backend Core:**
- FastAPI 0.135.1 — REST API + SSE streaming (`backend/requirements.txt`)
- Pydantic 2.10.3 + pydantic-settings 2.7.0 — request/response validation and settings management (`backend/app/config.py`)
- SQLAlchemy 2.0.36 (asyncio) — ORM with async engine (`backend/app/database.py`)
- Alembic 1.14.0 — database migration tool (`backend/alembic.ini`)
- APScheduler 3.10.4 — in-process async cron scheduler (`backend/app/scheduler/jobs.py`)
- slowapi 0.1.9 — rate limiting middleware (`backend/app/limiter.py`)

**Frontend Core:**
- React 19.2.0 — UI framework (`frontend/package.json`)
- React Router DOM 7.13.1 — client-side routing
- TanStack React Query 5.90.21 — server state management and caching
- Axios 1.13.6 — HTTP client with interceptors (`frontend/src/api/client.ts`)
- Tailwind CSS 4.2.1 (via Vite plugin `@tailwindcss/vite`) — utility-first CSS
- Radix UI — headless primitives: Dialog, DropdownMenu, Label, Popover, ScrollArea, Separator, Slot, Tooltip
- @dnd-kit (core 6.3.1 / sortable 10.0.0 / modifiers 9.0.0 / utilities 3.2.2) — drag-and-drop task ordering
- date-fns 4.1.0 — date manipulation
- lucide-react 0.575.0 — icon set
- sonner 2.0.7 — toast notifications
- clsx + tailwind-merge + class-variance-authority — conditional class utilities

**Testing:**
- Backend: pytest 8.3.4 + pytest-asyncio 0.24.0 + pytest-cov 6.0.0 + anyio 4.7.0 (`backend/requirements.txt`)
- Frontend unit: Vitest 4.0.18 + @vitest/coverage-v8 (`frontend/package.json`)
- Frontend E2E: Playwright 1.58.2 with Chromium only (`frontend/playwright.config.ts`)

**Build/Dev:**
- Vite 7.3.1 — frontend bundler with HMR and dev proxy (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 — Babel/React Fast Refresh
- ESLint 9.39.1 + typescript-eslint 8.48.0 + eslint-plugin-react-hooks/react-refresh (`frontend/eslint.config.js`)
- tsc 5.9.3 — TypeScript type checking (no-emit, strict mode)
- Docker + docker-compose (production) / docker-compose.dev.yml (development with live reload)

## Key Dependencies

**Critical Backend:**
- `asyncpg 0.30.0` — native async PostgreSQL driver (used by SQLAlchemy async engine)
- `python-jose[cryptography] 3.5.0` — JWT creation and verification, HS256 algorithm (`backend/app/auth/jwt.py`)
- `passlib[bcrypt] 1.7.4` + `bcrypt 4.2.1` — password hashing with bcrypt (`backend/app/routers/auth.py`)
- `python-multipart 0.0.22` — required by FastAPI for form parsing
- `pytz 2024.2` — timezone support for APScheduler
- `brotli 1.1.0` — Brotli compression (supplements GZip middleware)
- `python-json-logger 4.0.0` — structured JSON log output (`backend/app/logging_config.py`)
- `sentry-sdk[fastapi] 2.29.1` — error tracking, conditionally initialized on `SENTRY_DSN` (`backend/app/main.py`)
- `httpx 0.28.1` — async HTTP client (available, used in tests)

**Critical Frontend:**
- `@tanstack/react-query 5.90.21` — all API data fetching uses Query hooks
- `axios 1.13.6` — base HTTP client; silent refresh interceptor on 401 implemented in `frontend/src/api/client.ts`
- `@sentry/react 10.47.0` — frontend error tracking, conditionally initialized on `VITE_SENTRY_DSN` (`frontend/src/main.tsx`)

## Configuration

**Environment Variables (from `.env.example` — never read `.env`):**

| Variable | Required | Purpose |
|----------|----------|---------|
| `SECRET_KEY` | **Required** — no default, app refuses to start | JWT signing key |
| `POSTGRES_USER` | Required in Docker | PostgreSQL credentials |
| `POSTGRES_PASSWORD` | Required in Docker | PostgreSQL credentials |
| `POSTGRES_DB` | Required in Docker | PostgreSQL database name |
| `DATABASE_URL` | Required for local non-Docker run | async SQLAlchemy connection string |
| `TEST_DATABASE_URL` | Required for tests | separate test database URL |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional, default 15 | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional, default 7 | Refresh token lifetime |
| `ALLOWED_ORIGINS` | Optional, default `http://localhost` | CORS allowed origins (comma-separated) |
| `SENTRY_DSN` | Optional, empty = disabled | Backend Sentry DSN |
| `VITE_SENTRY_DSN` | Optional, empty = disabled | Frontend Sentry DSN |
| `ENVIRONMENT` | Optional, default `production` | Passed to Sentry |
| `LOG_LEVEL` | Optional, default `INFO` | Python logging level |
| `LOG_FILE` | Optional, default empty (stderr only) | Log file path |

All settings are loaded via `pydantic-settings` in `backend/app/config.py`, reading from `.env` file.

**Build Config:**
- `backend/alembic.ini` — Alembic migration config; URL is overridden at runtime from `settings.database_url` (see `backend/alembic/env.py`)
- `frontend/vite.config.ts` — Vite config with path alias `@/` → `./src/`, dev proxy `/api` → `http://api:8000`, manual chunks for vendor splitting
- `frontend/tsconfig.app.json` — strict TypeScript: `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"target": "ES2022"`, path alias `@/*` → `./src/*`

## Platform Requirements

**Development:**
- Docker + Docker Compose (primary workflow via `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`)
- Local run: Python 3.12 + pip for backend; Node 22 + npm for frontend
- PostgreSQL 16 (Docker container, `docker-compose.yml` uses `postgres:16-alpine`)
- `CHOKIDAR_USEPOLLING=true` set in dev compose for Windows/WSL2 file-watch compatibility

**Production:**
- VPS deployment via GitHub Actions (`deploy.yml`): SSH into `/opt/todo-app`, `git reset --hard`, `docker compose build`, `docker compose up -d`
- Frontend served by Nginx 1.27-alpine on port 80; Nginx proxies `/api/` to FastAPI at `http://api:8000`
- TLS/HTTPS configured externally (Caddy on VPS, per `docs/deployment.md` reference in `CLAUDE.md`)
- Production health endpoint: `GET /api/health` — returns 503 if DB unreachable
- CI: GitHub Actions (`ci.yml`) runs backend tests, frontend tsc + Vitest, Docker build check, Playwright E2E sequentially

---

*Stack analysis: 2026-06-19*
