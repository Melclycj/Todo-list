# Database Schema

> PostgreSQL 16 | Managed by Alembic migrations

---

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| hashed_password | VARCHAR | bcrypt hash |
| created_at | TIMESTAMPTZ | |

### `topics`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR(100) | Unique per user |
| created_at | TIMESTAMPTZ | |

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | VARCHAR(255) | |
| description | TEXT | Nullable |
| due_date | TIMESTAMPTZ | Nullable |
| status | ENUM | `todo`, `in_progress`, `done` |
| result_note | TEXT | Nullable |
| archived | BOOLEAN | Default false |
| done_at | TIMESTAMPTZ | Set when status → done |
| archived_at | TIMESTAMPTZ | Set by scheduler |
| manual_order | INTEGER | For same-day drag sort; nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `task_topics` (join table)
| Column | Type |
|--------|------|
| task_id | UUID FK → tasks |
| topic_id | UUID FK → topics |
| PK | (task_id, topic_id) |

### `recurring_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | VARCHAR(255) | |
| description | TEXT | Nullable |
| frequency | ENUM | `weekly`, `fortnightly`, `monthly` |
| is_active | BOOLEAN | False = stopped permanently |
| next_run_at | TIMESTAMPTZ | When next instance should be created |
| created_at | TIMESTAMPTZ | |

### `recurring_template_topics` (join table)
| Column | Type |
|--------|------|
| template_id | UUID FK → recurring_templates |
| topic_id | UUID FK → topics |
| PK | (template_id, topic_id) |

### `recurring_instances`
| Column | Type |
|--------|------|
| template_id | UUID FK → recurring_templates |
| task_id | UUID FK → tasks |
| PK | (template_id, task_id) |

### `refresh_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| token_hash | VARCHAR(64) | SHA-256 hex digest |
| expires_at | TIMESTAMPTZ | |
| revoked | BOOLEAN | Default false |

---

## Key Indexes

```sql
-- User task queries (highest frequency — SSE reminder counts)
CREATE INDEX ix_tasks_user_id_due_date ON tasks(user_id, due_date);

-- Active/archived task list
CREATE INDEX ix_tasks_user_id_archived ON tasks(user_id, archived);

-- Scheduler archiving job (no user_id filter)
CREATE INDEX ix_tasks_status_archived ON tasks(status, archived);

-- Due date sorting and window filters
CREATE INDEX ix_tasks_due_date ON tasks(due_date);

-- Topic filter subquery
CREATE INDEX ix_task_topics_topic_id ON task_topics(topic_id);

-- Scheduler recurring job
CREATE INDEX ix_recurring_next_run ON recurring_templates(next_run_at) WHERE is_active = true;
```
