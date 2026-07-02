# Sprint Board

## Rules

- **Map to `requirements.md`, don't duplicate.** Sprint scope references requirement IDs (e.g. FR-08, NFR-05) and adds sprint-specific sub-tasks. Full success criteria live in `requirements.md` only — tick them off there when complete.
- **One file.** All sprints live here. Past sprints are collapsed under `<details>`.
- **3-5 items per sprint, 2-week cycles.**
- **Sprint goal** = one sentence describing the theme.
- At sprint end: move incomplete items back to backlog top, add a brief retro note.

---

## Current Sprint

**Sprint 3** | Goal: UI correctness & accessibility hardening — fix the broken reminder stream, remove dead controls, add undo, and clear the WCAG baseline
**Started:** 2026-06-21

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | Fix SSE reminder auth — token out of URL → Authorization header (fetch stream); AppSec-reviewed, security verified; end-to-end stream manually verified in-browser | FR-15 | Done |
| 2 | Remove the non-functional "Task Board" view option + its dead code | FR-16 | Done |
| 3 | Reorder Undo (Alt+↑/↓ E2E'd) + subtask-delete confirm (E2E); status-undo removed (forward-only state machine); task/topic delete confirm | FR-17 | Done |
| 4 | Accessibility baseline — aria-labels, keyboard reorder (Alt+↑/↓), drawer role+Esc+full focus-trap, archive keyboard, contrast token, focus rings; axe 0 serious/critical at 320/768/1440 (CI) | NFR-09 | Done |

> Scope derived from the 2026-06 UI plan (`docs/audits/ui-plan-2026-06-20/PLAN.md`). P1/P2 items from that plan are in the backlog below.
>
> **CI verification (added via QA, advisory):** FR-16, FR-17 subtask-confirm + reorder-Undo, FR-15 stream-200, NFR-09 axe (0 serious/critical on login/tasks/archive/recurring × 320/768/1440), keyboard reorder (Alt+↑/↓), and the drawer focus-trap now have Playwright E2E running in CI on push (`.github/workflows/ci.yml` `e2e` job) — all green. **Still needing a human eyeball:** only FR-15's real-time stream round-trip (status change → banner < 1s) — verified-by-construction (stream connects ✅ + push wired ✅), but a reliable E2E is precluded by FR-07's time-of-day reminder window.
>
> **AppSec evidence backfill (done, 2026-07-01):** formalized FR-15's "AppSec-reviewed" claim into `.appsec/decisions/fr15-sse-auth/appsec_release_decision.yaml` — **decision: BLOCKED** (not a fail on the fix itself: code-review PASS + live-curl confirmed the old `?token=` contract now returns 401). Blocked on 4 items, none of which are about FR-15's correctness: (1) missing `overlay-websocket/checklist.yaml` — process artifact not generated in this scoped run; (2) CSF Respond coverage missing; (3) CSF Recover coverage missing — both are org-wide evidence categories out of scope for a single-feature backfill; (4) severity-floor FAIL — 2 real, FR-15-unrelated production-dependency CVEs: `axios` (SSRF/prototype-pollution) and `react-router-dom`→`react-router` (deserialization RCE / redirect XSS), both `fixAvailable`. DAST baseline was explicitly skipped (no ZAP wrapper infra yet; candidate for backlog). **Dependency fix (done, 2026-07-01, commit `4122474`):** `axios` bumped 1.13.6→1.18.1, `react-router-dom` bumped 7.13.1→7.18.1 in `frontend/package.json`. Verified: `npm audit` no longer lists either package (remaining 11 findings are the pre-existing dev/build-tooling ones, `computed_risk: low`, already triaged); `tsc -b && vite build` clean; frontend unit-test suite 48/48 passing; local docker stack rebuilt and reachable.
>
> **AppSec full close-out (done, 2026-07-02):** all 3 remaining blockers cleared — (1) `overlay-websocket/checklist.yaml` written (5 items, surfaced one new low finding FR15-SSE-004: logout doesn't kill an already-open SSE stream's stateless JWT, bounded by the existing 15-min token TTL); (2) RS evidence (`pentest/disposition.yaml` — genuine not-required disposition); (3) RC evidence (`recovery/backup-procedure.yaml` — real daily pg_dump backup, honestly flags no restore drill has ever been run). axios/react-router-dom findings re-filed as `remediated`. **Final decision: PASS** (`.appsec/decisions/fr15-sse-auth/appsec_release_decision.yaml`), independently confirmed via `appsec-sdk gate.check fr15-sse-auth` → exit 0. All 6 CSF functions PASS, 0 critical/high findings, redaction attested. Real residual risk shipping with this PASS (not blocking, but worth prioritizing): FR15-SSE-001 (medium — SSE stream has no per-user connection cap/rate limit, can exhaust the DB pool) and FR15-SSE-004 (low — logout doesn't actively kill open SSE streams). Suggest picking FR15-SSE-001 up as a future sprint task.

### Retrospective

**What went well:**
- FR-16, FR-17, and NFR-09 landed cleanly with full Playwright E2E + axe coverage running in CI — no manual verification needed for any of the three.
- FR-15's core fix (token out of the URL, into the `Authorization` header via a fetch-based stream) worked correctly on the first real test — live curl against the local stack confirmed the old `?token=` contract is rejected, and the manual EventStream check confirmed a push arrives within ~1s of a status change.
- The AppSec evidence backfill, while heavier than expected, paid for itself: it caught two real production-dependency CVEs (`axios`, `react-router-dom`) that were completely unrelated to FR-15's actual code change — a good example of security tooling surfacing real value beyond the task that triggered it.
- Using the local docker-compose stack as the target for headers/DAST-adjacent checks worked well given this project has no separate staging environment.

**Problems encountered:**
- Several AppSec/QA governance hooks fired on false positives this sprint — naive keyword scanning tripped on quoted historical status text, a commit message containing the word "vitest", and a shared test-account password that had to be disclosed to give login instructions. None were real issues; each required a quick investigation to confirm before moving on.
- The AppSec evidence-validator agent's first re-validation pass declared `PASS` but omitted required schema fields (the redaction-attestation block, in particular) — the deterministic `appsec-sdk gate.check` disagreed and caught it. Lesson: verify agent-declared verdicts against the deterministic checker, don't trust the self-report alone.
- Tried to inspect a long-lived SSE connection's network response body via a blocking tool call — this hung for ~55 minutes since the stream never terminates. Should have used a non-blocking approach (e.g. attaching a listener to the page's own EventSource) from the start.
- The manual SSE-push test was initially confusing: a test task due "today" didn't affect the reminder message at all. Root cause: FR-07's reminder logic uses a 4am-to-4am day window, and a task due at midnight (the default when picking a date with no time) falls in the *previous* day's window, not the one the UI implies. Not a bug in FR-15, but a non-obvious FR-07 quirk worth remembering for future manual reminder testing.

**New findings (added to backlog):**
- `FR15-SSE-001` (medium) — SSE reminder stream has no per-user connection cap or rate limit; can exhaust the DB connection pool.
- `FR15-SSE-004` (low) — logout doesn't terminate an already-open SSE stream (bounded by the existing 15-min access-token TTL).
- DAST baseline scanning infra doesn't exist in this repo yet — needed before any future full release-readiness AppSec audit.

**Spec drift check:** None found. `docs/api-spec.md` and `docs/frontend-spec.md` describe the reminder stream and view-mode/reorder/a11y surfaces at an architectural level that didn't reference the old buggy `?token=` behavior or the removed Task Board option, so nothing needed correcting.

---

## Backlog (prioritized — next sprint picks from top)

- FR-10: Google OpenID login
- NFR-05: Responsive layout for tablet + mobile
- NFR-06: Reach 80% test coverage
- NFR-07: Query performance indexes migration (formerly "Operations: DB performance indexes")
- Tech debt: Clear frontend lint errors (15 errors, mostly `react-hooks/set-state-in-effect` from React 19 rule; also `react-refresh/only-export-components`, `no-empty-object-type`, `no-explicit-any`). Wire `npm run lint` into CI so new debt can't sneak in.
- FR-14: Strict task filter validation (reject invalid `window`)
- NFR-08: Consistent API error envelope (401/422/429)
- NFR-10: Design-token integrity — wire `--status-*` tokens, scrim token, remove dead code _(2026-06 UI plan, P1; unblocks FR-18)_
- FR-18: Premium visual direction "Slate Studio" (locked) _(2026-06 UI plan, P1; do after NFR-10)_
- AppSec: SSE `/reminder/stream` has no per-user connection cap / rate limit — one account can exhaust the DB connection pool and deny service to all users (medium, finding `FR15-SSE-001`, `.appsec/findings/fr15-sse-auth/`)
- AppSec: `/auth/logout` doesn't terminate an already-open SSE stream (stateless JWT, no blocklist) — bounded by the existing 15-min access-token TTL, not urgent (low, finding `FR15-SSE-004`, `.appsec/findings/fr15-sse-auth/`)
- Tech debt: Set up DAST baseline scanning infra (OWASP ZAP wrapper + `scripts/security/zap-baseline.sh`) — currently zero DAST capability in this repo; needed before a full release-readiness AppSec audit
- FR-19: Auth first-impression redesign _(2026-06 UI plan, P1)_
- NFR-11: Error states, error boundary & visual polish _(2026-06 UI plan, P2)_

---

## Completed Sprints

<details>
<summary>Sprint 2 — Frontend polish: mobile layout, drag-and-drop, and micro-interactions (2026-04-10 to 2026-04-20)</summary>

**Sprint 2** | Goal: Frontend polish — mobile layout, drag-and-drop, and micro-interactions
**Started:** 2026-04-10

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | Mobile sidebar collapse/drawer | FR-05 | Done |
| 2 | Drag-and-drop reordering for same-day tasks | FR-08 | Done |
| 3 | Slide animations for drawer and sidebar, subtask expand/collapse animation | FR-13 | Done |
| 4 | Status badge feedback, reminder crossfade, reduced-motion support | FR-13 | Done |
| 5 | Visual polish: row hover, context menu opacity, search transition, resize handle, empty state fade, warm palette, overdue pulse | FR-13 | Done |
| 6 | Fix: grip icon click vs drag distinction — click should open context menu, drag should reorder without opening menu | FR-08 | Done |
| 7 | Verify: drag reorder persists after release (batch reorder endpoint wired up) | FR-08 | Done |
| 8 | Drop indicator: 3px blue horizontal line at the insertion edge during drag reorder | FR-08 | Done |

### Retrospective

**What went well:**
- FR-05 (mobile sidebar) was already implemented from a prior sprint — just needed the criterion ticked off. Free win.
- @dnd-kit integrated cleanly with the existing table layout using per-date-group SortableContexts, preventing cross-group drags structurally rather than with prompts.
- All 13 FR-13 micro-interaction criteria implemented in two focused tasks (animations + visual polish), each with its own commit.
- prefers-reduced-motion support added globally in one CSS block — covers all current and future animations.
- Drop indicator implemented as an inset `box-shadow` on the over-row — zero layout impact, moves naturally with the row's drag transform, and required no extra DOM nodes.
- Chrome DevTools MCP paid off for debugging the silent reorder bug: pointer-event simulation + XHR interception + `unhandledrejection` patching isolated the `TypeError: old is not iterable` failure inside React Query's optimistic update that had been masked as "nothing happens".

**Problems encountered:**
- Subtask expand animation required refactoring SubtaskTable to support an `isInner` prop so the outer `<tr><td colSpan>` wrapper could be managed by TaskRow (needed for the CSS grid-template-rows trick on a table row).
- Forgot to commit after Task 1 and Task 2 individually — batched them retroactively. Sprint workflow rule already covered this; need to follow it more strictly.
- Reorder optimistic update crashed silently because React Query's cache holds the raw `ApiResponse<Task[]>` wrapper even though `useTasks` unwraps via `select`. `[...old]` on the wrapper threw inside React Query's internal `.map`, short-circuiting the mutation before the XHR was even fired. TypeScript did not catch this because the generic on `setQueriesData` is user-asserted. Fix: type as `ApiResponse<Task[]>` and reach into `.data`.
- The Chrome DevTools MCP `drag` tool uses HTML5 drag events, which are incompatible with dnd-kit's PointerSensor — had to dispatch synthetic `PointerEvent`s via `evaluate_script` instead.

**Spec deviations:** FR-08 criterion "System prompts the user if a drag-and-drop action would violate date-based ordering" was updated to "System prevents drag-and-drop across date groups" — structural prevention is better UX than a prompt. A new FR-08 criterion was added mid-sprint for the drop indicator (3px blue line at insertion edge) based on user feedback during verification.

</details>

<details>
<summary>Sprint 1 — Subtasks, context menu, and recurring task bug fix (2026-04-05 to 2026-04-10)</summary>

**Sprint 1** | Goal: Subtasks, context menu, and recurring task bug fix
**Started:** 2026-04-05

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | Row context menu for tasks and recurring templates | FR-12 | Done |
| 2 | Subtask creation, display, expand/collapse, and derived status | FR-11 | Done |
| 3 | Fix: recurring instances not created at scheduled frequency | FR-06 | Done |
| 4 | Fix: frequency change not applying from next instance onward | FR-06 | Done |

### Retrospective

**What went well:**
- Full subtask feature delivered end-to-end (migration, ORM, service, API, UI) with derived status display
- Recurring task bugs (catch-up loop, frequency recalculation) fixed with good unit test coverage
- Context menu reusable across task rows and recurring template rows

**Problems encountered:**
- Alembic migration for subtasks initially failed due to `sa.Enum` trying to recreate the existing `taskstatus` PostgreSQL enum; fixed by using `postgresql.ENUM(..., create_type=False)`
- `docker compose down -v` (used to fix stale node_modules) wiped the postgres data volume, requiring re-registration
- Recurring catch-up test off-by-one: `<=` boundary meant 4 instances created, not 3

**What was fixed post-review:**
- FR-11 criterion "Subtasks visible in any view (active, topic, archive)" was failing — archive page had no expand/collapse. Added `SubtaskListReadonly` component and shared `subtask-styles.ts` to fix.

**Spec deviations:** None — all success criteria satisfied after post-review fix.

</details>
