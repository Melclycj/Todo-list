# Sprint Workflow

## Session Start

1. Read `docs/sprints.md` to check for an active sprint.
2. If no active sprint: ask the user to start one (`/sprint start`).
3. If active sprint exists: work on the next incomplete task in the current scope.

## Handling New Feature Requests

Any new feature must have a requirement in `docs/requirements.md` before implementation begins.

1. Draft the requirement with success criteria following the existing format. All success criteria must be **SMART**: Specific (exact behavior), Measurable (binary pass/fail via test), Achievable, Relevant, Time-bound (handled at sprint level, not per criterion).
2. Present the draft to the user for confirmation.
3. Once confirmed, add to `docs/requirements.md`.
4. Ask: **"Add to backlog (next sprint) or current scope (implement now)?"**
5. Backlog: append to the backlog section in `docs/sprints.md`.
6. Current scope: add to the active sprint's task list and implement immediately.

## Task Completion

For each task in the sprint scope:
1. Look up the requirement's success criteria in `docs/requirements.md`.
2. Write test cases that verify every success criterion.
3. Implement the feature / fix until all tests pass.
4. **Verify success criteria** — go through each criterion one by one:
   - **Automatable criterion** (can be verified via test or code inspection): run the test or inspect the code. If it fails, iterate on the implementation until it passes. Tick it off in `docs/requirements.md` once verified.
   - **Manual criterion** (requires human interaction, visual check, or external system): mark the sprint task as `Waiting for User` and list the criteria that need manual confirmation. Do NOT mark the task Done.
5. If ALL criteria are satisfied (all ticked): **commit immediately** with a descriptive message. Do not include requirement IDs in commits — traceability lives in `sprints.md`. Every completed task MUST have its own commit before moving to the next task. Mark the task as **Done** in `docs/sprints.md`.
6. If some criteria are `Waiting for User`: commit the implementation, mark the task as `Waiting for User` in `docs/sprints.md`, and move to the next task.

Do NOT mark a task Done without ALL success criteria verified, passing tests, **and a commit**.

## Sprint Lifecycle

Sprint state transitions are managed via the `/sprint` skill:
- **`/sprint start`** — create a new sprint with confirmed scope
- **`/sprint stop`** — runs retrospective, spec drift check, success criteria verification, and changelog update
- **`/sprint archive`** — collapse completed sprint into history

Auto-trigger: When all tasks are **Done**, automatically invoke `/sprint stop`.
If any tasks are **Waiting for User**, stop working and let the user invoke `/sprint stop` manually after they finish.
