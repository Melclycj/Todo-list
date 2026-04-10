# Todo List

A task management web app with recurring tasks, topic-based organization, SSE reminders, and automatic archiving built around a 4am day boundary.

**Tech stack:** React 19 + FastAPI + PostgreSQL 16, containerized with Docker.

## Features

- Task CRUD with status tracking (To Do / In Progress / Done)
- Topic-based organization and filtering
- Time-window filters (Today, 3 Days, Week, All)
- Recurring tasks (weekly, fortnightly, monthly) with auto-generation
- Dynamic reminder banner based on daily progress
- Automatic archiving of completed tasks at 4am boundary
- Full-text search across tasks
- JWT auth with HTTP-only refresh tokens

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

## Setup

```bash
cp .env.example .env
# Edit .env and fill in real values for SECRET_KEY and POSTGRES_PASSWORD
```

## Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open **http://localhost:5173**

If volume persist from older build:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Production

```bash
docker compose up --build
```

Open **http://localhost:8080**

## Changelog

### v1.1.0 (2026-04-06)

- **Subtasks**: Create subtasks under any task with derived parent status (Not Started / In Progress: n/m / Done), expand/collapse UI, and cascade delete
- **Row context menu**: "More options" icon on task rows (Delete, Add Subtask) and recurring template rows (Delete, Stop)
- **Recurring fix**: Catch-up loop creates all overdue instances when scheduler runs late, not just one
- **Recurring fix**: Frequency changes now correctly recalculate next_run_at from the last scheduled date
- **Archive subtask view**: Archived tasks with subtasks can now be expanded to show their subtask list (read-only)

### v1.0.2 (2026-04-05)

- Inline popup editor for all editable columns (portal-positioned, scroll-safe)
- Resizable columns and multiline description editing on recurring tasks page
- View mode dropdown (table/board)
- Gzip/brotli compression and frontend bundle optimization
- Sentry error tracking (backend + frontend)
- BetterStack uptime monitoring

### v1.0.1 (2026-04-05)

Initial tagged release. Core features complete:
- Task management with full CRUD and status transitions
- Topic creation, assignment, and sidebar navigation
- Recurring task templates with scheduled instance generation
- Time-based filtering and search
- Dynamic reminder banner with SSE updates
- Archive view with restore capability
- Auth (register, login, logout) with refresh token rotation
- CI/CD pipeline with automated testing and deployment
