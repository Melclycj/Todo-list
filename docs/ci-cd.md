# CI/CD & Testing

---

## CI Pipeline (`ci.yml`)

Triggers: all pushes and PRs targeting `main`.

```
1. Checkout
2. Backend: pip install → pytest with coverage (fail if < 80%)
3. Frontend: npm ci → vitest with coverage (fail if < 80%) → tsc --noEmit
4. Docker: docker compose build (validates Dockerfiles)
```

PRs cannot merge if CI fails.

## CD Pipeline (`deploy.yml`)

Triggers: push to `main` only.

```
1. SSH into VPS
2. git pull origin main
3. docker compose up -d --build
4. alembic upgrade head
5. Health check: curl /api/health (fail deploy if not 200)
```

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` in GitHub repository secrets.

---

## Testing Strategy

### Backend

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | pytest + pytest-asyncio | Services >= 80% |
| Integration | pytest + httpx (TestClient) | All API endpoints |
| DB | pytest with test database | Repository layer |

### Frontend

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | Vitest + React Testing Library | Hooks and utilities |
| Component | Vitest + React Testing Library | Key feature components |
| E2E | Playwright | Critical user flows |

### Running Tests Locally

```bash
# Backend
cd backend && pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend
cd frontend && npm test
cd frontend && npm run test:e2e   # requires full stack running
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production. Protected — no direct pushes. |
| `DEV` | Integration branch. Features merge here first. |
| `feat/*`, `fix/*`, `chore/*` | Short-lived feature branches. |

---

## PR Checklist

- [ ] Tests pass (unit + integration)
- [ ] No new audit vulnerabilities
- [ ] No secrets committed
- [ ] Migrations have `downgrade()`
- [ ] Branch is up to date with target
