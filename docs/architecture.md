# Architecture

> Stack: FastAPI (Python 3.12) + React 19 + PostgreSQL 16

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build tool | Vite |
| UI components | shadcn/ui + Tailwind CSS |
| Server state | TanStack Query (React Query) |
| Frontend routing | React Router v7 |
| Backend | FastAPI (Python 3.12) |
| ORM | SQLAlchemy 2.0 (async) |
| DB driver | asyncpg |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Authentication | JWT (python-jose) + bcrypt |
| Scheduler | APScheduler |
| Containerisation | Docker + Docker Compose |
| Reverse proxy | Nginx |

---

## Architecture Overview

```
Browser
  └── React SPA (thin client)
        │ HTTPS
        ▼
      Nginx
        ├── /         → React build (static files)
        └── /api/*    → FastAPI (Uvicorn)
                         │
                         ▼
                       PostgreSQL 16
```

---

## Architecture Principles

### Thin Client

The frontend is a rendering layer only. No business logic in the frontend.

| Responsibility | Frontend | Backend |
|----------------|----------|---------|
| Render data | Yes | No |
| User interaction / navigation | Yes | No |
| Filter / sort / order tasks | No | Yes |
| Compute reminder message | No | Yes |
| Archive tasks at 4am | No | Yes |
| Generate recurring instances | No | Yes |
| Validate business rules | No | Yes |
| Input schema validation | Lightweight (UX only) | Authoritative |

### Layered Backend

```
HTTP Request
    ↓
Router       — Parses request, validates schema, calls service, returns response
    ↓
Service      — All business logic; orchestrates repositories
    ↓
Repository   — Database queries only; no business logic
    ↓
Model        — SQLAlchemy ORM definitions
```

No layer may be skipped. Routers must not query the database directly. Repositories must not contain business rules.

### API-First

All features are API endpoints first. The frontend is built on top of the API.

### Immutability

Prefer creating new records over mutating existing ones where state history is relevant. Use `updated_at` timestamps to track changes.
