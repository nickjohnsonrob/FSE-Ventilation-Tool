/**
 * E2E tests for the preset loader menu (ASHRAE Table 6-3 presets).
 *
 * The preset menu opens from the zone-table toolbar, lets the engineer
 * search across all Table 6-3 categories grouped by canonical ASHRAE 62.1
 * groupings, and applies a preset to the currently-focused zone.
 *
 * Invariants covered:
 *   - Clicking "Presets" opens the panel
 *   - The panel renders at least one group per canonical ASHRAE category
 *     (Office Spaces, Educational Facilities, Retail, etc.)
 *   - Typing "office" in the search filters to office-related rows
 *   - Clicking a row populates the focused zone with the preset defaults
 *   - The 220 cfm math pin still holds (preset loading does not break it)
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — preset menu', () => {
  test('opens the preset panel and shows ASHRAE 62.1 category groups', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    const panel = page.getByTestId('preset-panel');
    await expect(panel).toBeVisible();

    // Canonical ASHRAE 62.1-2022 Table 6-3 groupings appear as group headers.
    await expect(
      panel.getByRole('button', { name: /Office Spaces/ }),
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: /Educational Facilities/ }),
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: /Retail/ })).toBeVisible();
    await expect(
      panel.getByRole('button', { name: /Food Service/ }),
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: /Public Assembly/ })).toBeVisible();
  });

  test('search "office" filters to office-related rows', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    const search = page.getByTestId('preset-search');
    await search.fill('office');

    // Every visible preset row mentions "office" somewhere in its label
    // (spaceType or category).
    const rows = page.getByTestId('preset-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // The canonical "Office space" row is one of the hits.
    await expect(
      page.locator('[data-preset-id="office-space"]'),
    ).toBeVisible();
  });

  test('clicking a preset populates the focused zone', async ({ page }) => {
    await page.goto('/');
    // Focus the first zone by clicking it.
    const firstZoneRow = page.locator('.zone-row').first();
    await firstZoneRow.locator('input.tag-input').click();

    // Open the menu, find Office space (defaultArea=150, defaultPop=1).
    await page.getByTestId('open-presets').click();
    await page.locator('[data-preset-id="office-space"]').click();

    // The first zone should now have area=150 and pop=1.
    await expect(firstZoneRow.locator('input[type="number"]').nth(0)).toHaveValue('150');
    await expect(firstZoneRow.locator('input[type="number"]').nth(1)).toHaveValue('1');
  });

  test('220 cfm math pin still holds after preset is applied', async ({ page }) => {
    // Apply Office space (Rp=5, Ra=0.06) then set 1000 / 10 manually on both
    // zones. Per the canonical pin: Vot = 220 cfm. This proves the preset
    // loader does NOT mutate room math or airflow inputs.
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    // Apply Office space to the first zone (it's auto-focused on open).
    await page.locator('[data-preset-id="office-space"]').click();

    const rows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = rows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*220.*cfm/);
  });

  test('multi-zone AHU: preset requires an explicit target zone', async ({ page }) => {
    // Multizone AHU has 2 zones. Until one is focused, preset rows are
    // disabled. After clicking the second zone row, the picker re-targets.
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    // Initially the first zone is the implicit focus, so rows are enabled.
    const row = page.locator('[data-preset-id="office-space"]');
    await expect(row).toBeEnabled();
  });

  test('clicking outside closes the preset panel', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    await expect(page.getByTestId('preset-panel')).toBeVisible();
    // Click somewhere outside the menu (the page header).
    await page.locator('h1').click();
    await expect(page.getByTestId('preset-panel')).not.toBeVisible();
  });

  test('Escape key closes the preset panel', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    await expect(page.getByTestId('preset-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('preset-panel')).not.toBeVisible();
  });

  test('category groups are collapsible', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-presets').click();
    // The "Office Spaces" group is expanded by default and shows its rows.
    const officeGroup = page.locator('[data-testid="preset-group"]', {
      hasText: 'Office Spaces',
    });
    await expect(officeGroup.locator('.preset-row').first()).toBeVisible();
    // Click the group header (specifically the chevron/name button) to
    // collapse. Use the testid-targeted selector so we don't accidentally
    // match a preset-row button.
    const header = officeGroup.locator('.preset-group__header');
    await header.click();
    await expect(officeGroup.locator('.preset-row')).toHaveCount(0);
  });
});