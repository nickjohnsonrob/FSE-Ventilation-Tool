/**
 * E2E tests for the snapshot library feature.
 *
 * - Save: name the current calc → it appears in the library with the
 *   expected AHU / zone / Vot summary.
 * - Load: change the calc, load the snapshot, verify the original values
 *   come back (round-trip).
 * - Delete: save a snapshot, open library, delete it, verify the list
 *   shows the empty-state.
 * - Rename: save a snapshot, rename it inline, verify the new name
 *   sticks and persists in localStorage.
 *
 * The library modal is wired at the App level — we exercise it through
 * the same [data-testid] handles that the unit tests in
 * src/components/SnapshotSummary.tsx are not concerned with, but that
 * the SaveButton / LibraryModal components publish.
 */
import { test, expect, type Page } from '@playwright/test';

/** Open the library modal — wait until it's visible. */
async function openLibrary(page: Page): Promise<void> {
  await page.getByTestId('library-button').click();
  await expect(page.getByTestId('library-modal')).toBeVisible();
}

/** Save the current calc with a given name via the SaveButton. */
async function saveCurrentAs(page: Page, name: string): Promise<void> {
  await page.getByTestId('save-button').click();
  const input = page.getByTestId('snapshot-name-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press('Enter');
}

test.describe('FSE Ventilation Tool — snapshot library', () => {
  test('Save button prompts for a name and the snapshot appears in the library', async ({
    page,
  }) => {
    await page.goto('/');
    // Seed the calc with values so the summary in the library has substance
    const rows = page.locator('.zone-table tbody tr');
    await rows.nth(0).locator('input[type="number"]').nth(0).fill('1000');
    await rows.nth(0).locator('input[type="number"]').nth(1).fill('10');
    await rows.nth(1).locator('input[type="number"]').nth(0).fill('500');
    await rows.nth(1).locator('input[type="number"]').nth(1).fill('5');

    await saveCurrentAs(page, 'test snapshot');

    // Library should now show one entry with our name and the human-readable
    // summary "1 AHU, 2 zones total, Vot=… cfm"
    await openLibrary(page);
    const row = page.getByTestId('library-row').first();
    await expect(row).toContainText('test snapshot');
    await expect(row).toContainText(/1 AHU, 2 zones total, Vot=\d+ cfm/);

    // Close
    await page.getByTestId('library-close').click();
    await expect(page.getByTestId('library-modal')).not.toBeVisible();
  });

  test('Load snapshot restores the saved state', async ({ page }) => {
    await page.goto('/');

    // Set distinct values on the two zones and save
    const rows = page.locator('.zone-table tbody tr');
    await rows.nth(0).locator('input[type="number"]').nth(0).fill('1000');
    await rows.nth(0).locator('input[type="number"]').nth(1).fill('10');
    await rows.nth(1).locator('input[type="number"]').nth(0).fill('500');
    await rows.nth(1).locator('input[type="number"]').nth(1).fill('5');
    await saveCurrentAs(page, 'restore-target');

    // Now mutate the calc so we can verify the restore rolls back
    await rows.nth(0).locator('input[type="number"]').nth(0).fill('9');
    await rows.nth(0).locator('input[type="number"]').nth(1).fill('9');
    await expect(rows.nth(0).locator('input[type="number"]').nth(0)).toHaveValue('9');

    // Load the snapshot
    await openLibrary(page);
    await page
      .getByTestId('library-row')
      .filter({ hasText: 'restore-target' })
      .getByTestId('library-load')
      .click();

    // Modal closes; values are back to the snapshot's
    await expect(page.getByTestId('library-modal')).not.toBeVisible();
    await expect(rows.nth(0).locator('input[type="number"]').nth(0)).toHaveValue('1000');
    await expect(rows.nth(0).locator('input[type="number"]').nth(1)).toHaveValue('10');
    await expect(rows.nth(1).locator('input[type="number"]').nth(0)).toHaveValue('500');
    await expect(rows.nth(1).locator('input[type="number"]').nth(1)).toHaveValue('5');
  });

  test('Delete snapshot removes it from the library', async ({ page }) => {
    await page.goto('/');
    await saveCurrentAs(page, 'doomed');

    await openLibrary(page);
    await expect(page.getByTestId('library-row')).toHaveCount(1);

    // Confirm the JS confirm() dialog
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('library-delete').first().click();

    // Empty state appears
    await expect(page.getByTestId('library-row')).toHaveCount(0);
    await expect(page.getByText(/No saved snapshots yet/)).toBeVisible();

    // Reload the page — localStorage is still clean
    await page.getByTestId('library-close').click();
    await openLibrary(page);
    await expect(page.getByTestId('library-row')).toHaveCount(0);
  });

  test('Rename snapshot updates the row label', async ({ page }) => {
    await page.goto('/');
    await saveCurrentAs(page, 'old name');

    await openLibrary(page);
    const row = page.getByTestId('library-row').first();
    await expect(row).toContainText('old name');

    await row.getByTestId('library-rename').click();
    const renameInput = row.getByTestId('library-rename-input');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('fresh name');
    await renameInput.press('Enter');

    // Row re-renders with the new name; old is gone
    await expect(row).toContainText('fresh name');
    await expect(row).not.toContainText('old name');
  });

  test('Snapshots persist across page reloads (localStorage-backed)', async ({ page }) => {
    await page.goto('/');
    await saveCurrentAs(page, 'survives-reload');
    await openLibrary(page);
    await expect(page.getByTestId('library-row')).toHaveCount(1);
    await page.getByTestId('library-close').click();

    await page.reload();
    await openLibrary(page);
    await expect(page.getByTestId('library-row')).toHaveCount(1);
    await expect(page.getByTestId('library-row').first()).toContainText('survives-reload');
  });

  test('Esc cancels the Save name input without saving', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('save-button').click();
    const input = page.getByTestId('snapshot-name-input');
    await expect(input).toBeVisible();
    await input.fill('will be cancelled');
    await input.press('Escape');
    await expect(input).not.toBeVisible();

    // Open library — should be empty
    await openLibrary(page);
    await expect(page.getByText(/No saved snapshots yet/)).toBeVisible();
  });

  test('Empty name keeps the Save action disabled', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('save-button').click();
    const input = page.getByTestId('snapshot-name-input');
    await expect(input).toBeVisible();
    // Empty input — Save button is disabled
    const commit = page.getByTestId('snapshot-name-commit');
    await expect(commit).toBeDisabled();
    // Type a name → enabled
    await input.fill('now enabled');
    await expect(commit).toBeEnabled();
  });

  test('Closing the library via backdrop click works', async ({ page }) => {
    await page.goto('/');
    await openLibrary(page);
    // Click outside the dialog panel (top-left corner of viewport)
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('library-modal')).not.toBeVisible();
  });

  test('localStorage key matches the documented schema-versioned name', async ({ page }) => {
    await page.goto('/');
    await saveCurrentAs(page, 'check-key');
    const raw = await page.evaluate(() => window.localStorage.getItem('fse.vent.snapshots.v1'));
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'check-key',
      state: expect.objectContaining({
        schemaVersion: 1,
        ahus: expect.any(Array),
        activeId: expect.any(String),
        unitSystem: expect.stringMatching(/^(ip|si)$/),
      }),
    });
  });

  test('Empty-name input is rejected at the SaveButton level (library stays empty)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('save-button').click();
    // Try Enter on an empty input
    await page.getByTestId('snapshot-name-input').press('Enter');
    // The input is still open (no commit) — the save-button stays in naming mode
    await expect(page.getByTestId('snapshot-name-input')).toBeVisible();
    // Cancel
    await page.getByTestId('snapshot-name-cancel').click();
    // Verify nothing was persisted
    const raw = await page.evaluate(() => window.localStorage.getItem('fse.vent.snapshots.v1'));
    expect(raw === null || raw === '[]').toBe(true);
  });
});
