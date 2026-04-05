# Todo List App

FastAPI + React 19 + PostgreSQL 16 task management app with recurring tasks, SSE reminders, and topic-based organization.

## Documentation Map

Reference these docs when working on specific areas. Do not load all at once — pick only what's relevant.

| File | What it covers | When to look it up |
|------|---------------|-------------------|
| `docs/architecture.md` | Tech stack, architecture principles, thin client rule, layered backend | Starting a new feature, making structural decisions |
| `docs/api-spec.md` | Backend structure, all API endpoints, auth flow, scheduler jobs, error handling, env vars | Adding/modifying endpoints, debugging API behavior |
| `docs/frontend-spec.md` | Frontend structure, state management, API communication rules, SSE, routing | Adding/modifying frontend features |
| `docs/database.md` | All table schemas, indexes, relationships | Writing queries, adding migrations |
| `docs/ci-cd.md` | CI/CD pipelines, testing strategy, branch strategy, PR checklist | Running tests, preparing PRs, debugging CI |
| `docs/operations.md` | Logging gaps, monitoring setup, optimization status, VPS update procedure | Debugging production, adding observability |
| `docs/deployment.md` | VPS setup, HTTPS (Caddy), GitHub CD secrets, backup/maintenance | First deploy or server setup |
| `docs/requirements.md` | Functional and non-functional requirements with completion status | Understanding what's built vs. what's pending |
| `docs/sprints.md` | Current sprint scope, backlog, and completed sprints | Starting any work session, picking next task |

## Key Architecture Rules

1. **Thin client**: Frontend renders only. All business logic lives in backend services.
2. **Layered backend**: Router → Service → Repository → Model. No layer skipping.
3. **API-first**: Every feature is an API endpoint first. Frontend is built on top.
4. **Immutability**: Prefer new objects over mutation.

## Common Commands

```bash
# Backend tests
cd backend && pytest tests/ -v --cov=app

# Frontend tests
cd frontend && npm test

# Full stack (Docker)
docker compose up -d --build

# Deploy (via PR merge to main — triggers deploy.yml)
```
