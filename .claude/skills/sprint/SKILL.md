---
name: sprint
description: "Sprint lifecycle management. Subcommands: start, stop, archive. Use `/sprint start` to begin a new sprint, `/sprint stop` to close the current sprint, `/sprint archive` to collapse a completed sprint."
---

# Sprint Management

Usage: `/sprint <start|stop|archive>`

## `/sprint start`

Precondition: No active sprint in `docs/sprints.md`.

Steps:
1. Read `docs/sprints.md` and `docs/requirements.md`.
2. List incomplete requirements and current backlog items.
3. Suggest 3-5 items for the next sprint scope, prioritized from backlog top.
4. Ask the user to confirm or adjust the scope.
5. Once confirmed, write the new sprint to `docs/sprints.md` under **Current Sprint** with this format:

```markdown
## Current Sprint

**Sprint N** | Goal: <one-sentence theme>
**Started:** YYYY-MM-DD

| # | Task | Req | Status |
|---|------|-----|--------|
| 1 | <task description> | FR-XX / NFR-XX | To Do |
| 2 | ... | ... | To Do |

### Retrospective
_Filled at sprint end._
```

6. Begin working on the first task.

## `/sprint stop`

Precondition: An active sprint exists in `docs/sprints.md`.

Auto-triggered when all tasks are **Done**. If tasks are **Waiting for User**, the user must invoke this manually after completing them.

Steps:
1. Verify all tasks are Done or Waiting for User. If any are still To Do / In Progress, list them and ask the user how to proceed (complete now, move to backlog, or mark waiting).
2. **Success criteria verification**: For every Done task, re-read its linked requirement in `docs/requirements.md` and verify each success criterion is satisfied. Run existing test cases to confirm. List any criteria that are not met — these must be resolved before the sprint can close.
3. Tick off verified success criteria in `docs/requirements.md`.
4. Fill in the **Retrospective** section:
   - What went well
   - Problems encountered
   - New requirements or bugs discovered (add to backlog if applicable)
5. **Spec drift check**: Compare what was implemented against `docs/` specs. Update any specs that no longer match.
6. Mark all completed tasks as Done in the sprint table.
7. Update the changelog in `README.md` with a summary of what was delivered.
8. Leave the sprint in place under **Current Sprint** (do not archive yet).
9. Ask the user if they want to archive and/or start the next sprint.

## `/sprint archive`

Precondition: Current sprint is stopped (retrospective filled, changelog updated).

Steps:
1. Move the current sprint from **Current Sprint** to **Completed Sprints**, wrapped in a `<details>` block:

```markdown
<details>
<summary>Sprint N — <goal> (YYYY-MM-DD to YYYY-MM-DD)</summary>

<!-- full sprint content here -->

</details>
```

2. Set **Current Sprint** to `_No active sprint._`
3. Move any Waiting for User or incomplete items to backlog top.
