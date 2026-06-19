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

## Workflow: Sprint-first, GSD as toolbox

This project's project-management spine is the **Sprint workflow** (`docs/sprints.md` + `docs/requirements.md` + the `/sprint` skill), per `.claude/rules/common/sprint-workflow.md`. GSD is used **only as a per-task execution/quality toolbox — never as the project manager.** This project-level rule **overrides** any global "GSD-first for non-trivial work" default.

**Sprint owns** (do not duplicate anywhere else): scope & backlog (`docs/sprints.md`), requirements with SMART success criteria (`docs/requirements.md`), lifecycle (`/sprint start|stop|archive`), and commit-per-task. `docs/sprints.md` is the single source of truth for what/when.

**GSD = toolbox.** Inside a single sprint task you MAY reach for standalone GSD tools/agents:

| Need | GSD tool |
|------|----------|
| Refresh codebase reference | `/gsd-map-codebase` → writes `.planning/codebase/` |
| Implement a small / chunky task | `/gsd-fast` · `/gsd-quick` · `/gsd-plan-phase` |
| Generate tests from success criteria | `/gsd-add-tests` |
| Systematic debugging (persistent state) | `/gsd-debug` |
| Pre-commit code review | `/gsd-code-review` |
| Security-sensitive task (auth / data) | `/gsd-secure-phase` (+ AppSec) |
| Fix `docs/` drift vs code | `/gsd-docs-update` |
| Feed the `/sprint stop` retrospective | `/gsd-extract-learnings` |

**GSD is the execution layer; "Done" is decided one level up.** GSD tools only *produce work* — including their own verdicts (`/gsd-verify-work`, `/gsd-code-review`, `gsd-ui-checker` BLOCK/FLAG/PASS). None of them completes a task. A task is Done **only** through the sprint **Task Completion gate** in `.claude/rules/common/sprint-workflow.md` — the single authority for what "Done" means and how GSD verdicts (advisory) and tool-generated tests (must verify the success criteria) feed it. The governing rule lives there, not here.

**NEVER run** (these make GSD seize project management and fight the sprint spine): `/gsd-new-project`, `/gsd-new-milestone`, roadmap commands, `/gsd-ship`. The release path is `/sprint stop` + CI (PR merge to `main`).

**No competing PM scaffold.** `.planning/` is scratch only (e.g. `.planning/codebase/`). Never create `.planning/PROJECT.md` / `ROADMAP.md` / `STATE.md` as a competing source of truth — `docs/sprints.md` is authoritative.

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
