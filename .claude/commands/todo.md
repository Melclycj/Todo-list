You manage a persistent project todo list stored at `.claude/todo.md`.

The user's input is: $ARGUMENTS

Handle the following actions based on the input:

## No arguments (empty) — Show the list
- Read `.claude/todo.md` and display it in a clean formatted view
- Group by status: pending items first, then completed
- Show item numbers for easy reference
- If the file doesn't exist, say the list is empty and suggest adding items

## `add: <task>` — Add a new item
- Append a new line `- [ ] <task>` under the `## Tasks` section in `.claude/todo.md`
- If the file doesn't exist, create it with the header and the new task
- Confirm what was added and show the updated list

## `done: <number>` — Mark item as complete
- Find the Nth uncompleted task (`- [ ]`) and change it to `- [x]`
- Confirm what was completed

## `undo: <number>` — Mark item as incomplete
- Find the Nth completed task (`- [x]`) and change it to `- [ ]`
- Confirm what was reopened

## `remove: <number>` — Remove an item
- Remove the Nth task line entirely (counting all tasks, both complete and incomplete)
- Confirm what was removed

## `clear` — Remove completed items
- Remove all lines with `- [x]` from the file
- Confirm how many items were cleared

## `priority: <number>` — Move item to top
- Move the Nth task to the top of the task list
- Confirm the reordering

## Rules
- Always read the current file before making changes
- Always show the updated list after any modification
- Number items sequentially starting from 1 in display
- Keep the file format clean and consistent
