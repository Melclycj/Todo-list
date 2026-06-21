import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

/**
 * FR-17: Subtask delete confirmation dialog.
 *
 * Flow: create task → open grip context menu → Add Subtask → persist via Enter
 * → hover subtask row → click "Delete subtask" button → assert confirm dialog
 * appears → Cancel keeps it → reopen + Delete removes it.
 */
test.describe('FR-17 subtask delete confirm', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `subtask-${uid()}@example.com`, 'password123')
  })

  test('delete subtask shows confirmation dialog; Cancel keeps it, Delete removes it', async ({ page }) => {
    const taskTitle = `SubtaskParent ${uid()}`
    const subtaskTitle = `MySub ${uid()}`

    // 1. Create a parent task + a sibling. The grip handle is hidden for
    //    single-item date groups (RowContextMenu hidden={isDragDisabled}), so
    //    we need 2 tasks in the same (no-date) group for the grip to render.
    await createTask(page, taskTitle)
    await createTask(page, `Sibling ${uid()}`)

    // 2. Open the grip context menu for the parent task row.
    const taskRow = page.locator('tbody tr', { hasText: taskTitle })
    // Hover the row so the opacity-0 grip handle becomes interactable.
    await taskRow.hover()
    const gripBtn = taskRow.getByRole('button', { name: /Actions and reorder|Actions/i })
    await gripBtn.click()

    // 3. Click "Add Subtask" in the dropdown
    await page.getByRole('menuitem', { name: 'Add Subtask' }).click()

    // 4. Type the subtask title in the focused ephemeral input and press Enter
    //    The input has placeholder "Enter subtask title..."
    const subtaskInput = page.getByPlaceholder('Enter subtask title...')
    await expect(subtaskInput).toBeVisible()
    await subtaskInput.fill(subtaskTitle)
    await subtaskInput.press('Enter')

    // 5. Wait for the subtask to appear in the DOM (API round-trip)
    await expect(page.getByText(subtaskTitle)).toBeVisible()

    // 6. Hover the subtask row to reveal the delete button
    //    The delete button is only rendered when isHovered === true
    const subtaskRow = page.locator('tr', { hasText: subtaskTitle })
    await subtaskRow.hover()

    // 7. Click the "Delete subtask" button (aria-label)
    const deleteBtn = subtaskRow.getByRole('button', { name: 'Delete subtask' })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // 8. Assert the confirmation dialog is visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Delete subtask?')).toBeVisible()

    // 9. Cancel — subtask must remain
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(subtaskTitle)).toBeVisible()

    // 10. Reopen and confirm delete — subtask must disappear
    await subtaskRow.hover()
    await subtaskRow.getByRole('button', { name: 'Delete subtask' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    // Wait for optimistic removal
    await expect(page.getByText(subtaskTitle)).not.toBeVisible()
  })
})
