# Todo List

Full-stack todo app — React + FastAPI + PostgreSQL, all running in Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

## Setup

```bash
cp .env.example .env
# Edit .env and fill in real values for SECRET_KEY and POSTGRES_PASSWORD
```

## Start (dev mode)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open **http://localhost:5173**

## Start (production)

```bash
docker compose up --build
```

Open **http://localhost:8080**
