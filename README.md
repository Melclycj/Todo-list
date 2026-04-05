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

## Production

```bash
docker compose up --build
```

Open **http://localhost:8080**

## Changelog

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
