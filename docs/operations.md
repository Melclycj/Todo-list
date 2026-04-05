# Operations & Monitoring

---

## Logging

### Current State

Only 2 files produce application logs:
- `middleware/error_handler.py` — unhandled 500 errors
- `scheduler/jobs.py` — job success/failure

### Gaps

| Gap | Impact |
|-----|--------|
| No request logging (method, path, status, duration) | Cannot see traffic patterns |
| No user ID / request ID in log context | Cannot trace requests |
| No service-layer logging | No audit trail |
| No structured format (JSON) | Hard to query in log aggregators |
| No log level configuration from env | Cannot switch DEBUG/INFO without code change |

### Recommended Additions

1. **Request ID middleware** — UUID per request, included in logs and `X-Request-ID` header
2. **Access log middleware** — method, path, status, duration per request
3. **Structured JSON logging** — `python-json-logger` for queryable log lines
4. **Service audit logs** — login, task deletion, etc.

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

### Recommended Stack (Minimal)

```
Sentry                    → error tracking + performance (free tier)
Uptime Robot / BetterStack → uptime + SSL expiry alerts (free tier)
VPS provider metrics      → CPU, memory, disk
```

### Day-One Alerts

1. Site is down (`/api/health` fails)
2. SSL certificate expires in < 14 days
3. Disk > 80%
4. Any container restart
5. 5xx error rate spike

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

When dependencies change in `requirements.txt` or `package.json`, Docker images must be rebuilt:

```bash
ssh vps
cd /opt/todo-app
git pull origin main
docker compose up --build -d
docker compose ps
docker compose logs api --tail=40
```

Dependencies are baked into Docker images at build time. Restarting without `--build` runs old packages.
