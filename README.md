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

### v1.2.1 (2026-04-12)

- **Drop indicator**: 3px blue horizontal line at the insertion edge during drag reorder — appears above the target row when dragging up, below when dragging down
- **Fix**: Drag reorder now actually persists — optimistic update no longer crashes on the React Query `ApiResponse` wrapper (`TypeError: old is not iterable`)
- **Fix**: Grip icon click vs drag — click opens context menu, drag (≥5px) reorders without triggering the menu

### v1.2.0 (2026-04-10)

- **Drag-and-drop reordering**: Tasks with the same due date can be reordered via drag handle; order persists across refreshes. Cross-date-group drags are structurally prevented.
- **Slide animations**: Task create drawer slides in/out from right, mobile sidebar slides in/out from left, subtask expand/collapse uses smooth height transition (all 200ms ease-out)
- **Micro-interactions**: Status badge press feedback (scale-95), reminder banner crossfade on message change (300ms), overdue date icon pulse
- **Visual polish**: Context menu icon visible at 30% by default, stronger row hover (bg-muted/40), search clear button fade, wider resize handle hit area, empty state fade-in, warm color palette (hue 220, 2% saturation)
- **Accessibility**: Global `prefers-reduced-motion: reduce` support disables all transitions and animations

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
