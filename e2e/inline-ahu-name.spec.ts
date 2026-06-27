/**
 * E2E tests for inline AHU name editing on the picker tab itself.
 *
 * P2 — the AHU name should be editable directly on the tab via a
 * double-click gesture, not only via the meta-strip input in the zone
 * table. This spec exercises the tab-level affordance:
 *
 *   - Double-click the active tab's label → swap to a text input
 *   - Type new name + Enter → tab label and meta-strip input update
 *   - Double-click, type new name + blur → also commits
 *   - Double-click, type new name + Escape → reverts to original
 *   - Double-click, clear field + Enter → reverts (no blank name)
 *   - Math pin (220 cfm) still holds after rename
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — inline AHU name edit on tab', () => {
  test('double-click tab, type new name, press Enter → tab label updates and meta-strip syncs', async ({
    page,
  }) => {
    await page.goto('/');

    const activeTab = page.locator('.ahu-tab--active');
    await expect(activeTab).toContainText('RTU-01');

    // Double-click the label to enter edit mode
    const label = activeTab.locator('.ahu-tab__name');
    await label.dblclick();

    // Inline input appears
    const input = page.locator('.ahu-tab__name-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // Replace the value and commit with Enter
    await input.fill('RTU-NORTH');
    await input.press('Enter');

    // Tab label updates
    await expect(activeTab.locator('.ahu-tab__name')).toContainText('RTU-NORTH');
    // Meta-strip input mirrors the new name (the two paths share state)
    await expect(page.getByTestId('ahu-name')).toHaveValue('RTU-NORTH');
  });

  test('double-click, type new name, blur → also commits', async ({ page }) => {
    await page.goto('/');

    const activeTab = page.locator('.ahu-tab--active');
    const label = activeTab.locator('.ahu-tab__name');
    await label.dblclick();

    const input = page.locator('.ahu-tab__name-input');
    await input.fill('RTU-EAST');

    // Blur by clicking somewhere harmless (the page heading)
    await page.getByRole('heading', { name: 'FSE Ventilation Calculation' }).click();

    await expect(activeTab.locator('.ahu-tab__name')).toContainText('RTU-EAST');
  });

  test('Escape reverts to the original name without committing', async ({ page }) => {
    await page.goto('/');

    const activeTab = page.locator('.ahu-tab--active');
    const label = activeTab.locator('.ahu-tab__name');
    await label.dblclick();

    const input = page.locator('.ahu-tab__name-input');
    await input.fill('GARBAGE-NAME');
    await input.press('Escape');

    // Tab and meta-strip both unchanged
    await expect(activeTab.locator('.ahu-tab__name')).toContainText('RTU-01');
    await expect(page.getByTestId('ahu-name')).toHaveValue('RTU-01');
    // No input lingering
    await expect(page.locator('.ahu-tab__name-input')).toHaveCount(0);
  });

  test('clearing the field and pressing Enter reverts to original (no blank name)', async ({
    page,
  }) => {
    await page.goto('/');

    const activeTab = page.locator('.ahu-tab--active');
    const label = activeTab.locator('.ahu-tab__name');
    await label.dblclick();

    const input = page.locator('.ahu-tab__name-input');
    await input.fill('');
    await input.press('Enter');

    await expect(activeTab.locator('.ahu-tab__name')).toContainText('RTU-01');
    await expect(page.getByTestId('ahu-name')).toHaveValue('RTU-01');
  });

  test('renaming does not disturb the active AHU selection', async ({ page }) => {
    await page.goto('/');

    // Add a second AHU so we can confirm activeId stays put
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // Active is now RTU-02; rename it
    const activeTab = page.locator('.ahu-tab--active');
    await expect(activeTab).toContainText('RTU-02');
    await activeTab.locator('.ahu-tab__name').dblclick();

    const input = page.locator('.ahu-tab__name-input');
    await input.fill('RTU-SOUTH');
    await input.press('Enter');

    // Active chip still active (RTU-SOUTH) and RTU-01 chip unchanged
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-SOUTH');
    await expect(page.locator('.ahu-tab', { hasText: 'RTU-01' })).toBeVisible();
  });

  test('220 cfm math pin still holds after renaming the active AHU', async ({ page }) => {
    await page.goto('/');

    // Seed the two-zone 1000/10/10 case on the default RTU-01:
    // For each row, set Area=1000, Pop=10. Rp=5, Ra=0.06 (Office space default).
    // Vbz = 5·10 + 0.06·1000 = 110 cfm per zone; Vou = 220; Vot = 220.
    const rows = page.locator('.zone-table tbody tr.zone-row');
    for (const r of await rows.all()) {
      const inputs = r.locator('input[type="number"]');
      await inputs.nth(0).fill('1000'); // area
      await inputs.nth(1).fill('10'); // pop
    }

    // Now rename the AHU
    const activeTab = page.locator('.ahu-tab--active');
    await activeTab.locator('.ahu-tab__name').dblclick();
    const input = page.locator('.ahu-tab__name-input');
    await input.fill('RTU-NORTH');
    await input.press('Enter');

    // Pin: results band still reads 220 cfm
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*220.*cfm/);
  });
});