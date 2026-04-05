# Operations & Monitoring

---

## Logging

### Current State

Only 2 files produce application logs:
- `middleware/error_handler.py` — unhandled 500 errors
- `scheduler/jobs.py` — job success/failure

### Resolved

- [x] Request ID middleware (`RequestIDMiddleware`) — UUID per request, `X-Request-ID` header
- [x] Access log middleware (`AccessLogMiddleware`) — method, path, status, duration
- [x] Structured JSON logging (`python-json-logger`)
- [x] Log level configurable via `LOG_LEVEL` env var

### Remaining Gaps

| Gap | Impact |
|-----|--------|
| No service-layer logging | No audit trail for login, task deletion, etc. |

---

## Monitoring

### Metrics to Track

| Category | Metric | Alert Threshold |
|----------|--------|-----------------|
| Infrastructure | CPU usage | > 80% sustained 5 min |
| Infrastructure | Memory usage | > 85% |
| Infrastructure | Disk usage | > 80% |
| Infrastructure | DB connections | > 80% of pool max |
| Application | HTTP 5xx rate | > 1% of requests |
| Application | API p95 response time | > 500ms |
| Application | Scheduler job failure | Any failure |
| Application | SSE connection count | Spike (connection leak) |
| Application | Failed logins | > 10/min per IP |

### Current Stack

| Tool | Purpose | Status |
|------|---------|--------|
| Sentry | Error tracking + performance | Active — backend (FastAPI) + frontend (React) |
| BetterStack | Uptime monitoring + status page | Active — monitors `/api/health` every 3 min |
| VPS provider metrics | CPU, memory, disk | Available via provider dashboard |

### Day-One Alerts

These are the minimum alerts that should be active from day one of production:

1. **Site is down** — BetterStack monitors `/api/health`, alerts on failure
2. ~~SSL certificate expires in < 14 days~~ — Not needed; Caddy auto-renews
3. **Disk > 80%** — Check via VPS provider dashboard/alerts
4. ~~Any container restart~~ — Covered indirectly: Sentry catches crash errors, BetterStack catches prolonged downtime from crash loops
5. **5xx error rate spike** — Sentry alerts on new errors; configure alert rule for rate spikes

---

## Optimization Status

### Backend

| Optimization | Status |
|-------------|--------|
| Database connection pooling | Done |
| N+1 prevention (`selectinload`) | Done |
| Database indexing | Pending migration |
| Pagination | Done |
| Rate limiting (`slowapi`) | Done |
| Full async I/O | Done |
| Gzip/brotli compression | Done |
| Background jobs (APScheduler) | Done |
| SSE over polling | Done |
| Unit of Work pattern | Done |
| Scheduler race guard (`SELECT FOR UPDATE SKIP LOCKED`) | Done |

### Frontend

| Optimization | Status |
|-------------|--------|
| Code splitting (`manualChunks`) | Done |
| Tree shaking (Vite + ESM) | Done |
| React Query caching | Done |
| Search debounce (300ms) | Done |
| Resize handlers RAF-throttled | Done |
| Bundle audit (352 KB → 96 KB index) | Done |
| Virtualization (react-virtual) | Future — needed if >200 rows |
| Service Worker / PWA | Future |

---

## VPS Dependency Updates

When dependencies change in `requirements.txt` or `package.json` and you are doing it without using CD pipeline, Docker images must be rebuilt:

```bash
ssh vps
cd /opt/todo-app
git pull origin main
docker compose up --build -d
docker compose ps
docker compose logs api --tail=40
```

Dependencies are baked into Docker images at build time. Restarting without `--build` runs old packages.
