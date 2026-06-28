/**
 * E2E tests for the Favorites feature in the preset menu.
 *
 * Invariants covered:
 *   - A star button is rendered on every preset row.
 *   - Clicking the star toggles a favorite; clicking again unfavorites.
 *   - Favorited rows appear in a "Favorites" group at the TOP of the menu.
 *   - Favorited rows are removed from their canonical group (no dupes).
 *   - Favorites survive closing and reopening the menu (persisted to localStorage).
 *   - Favorites survive an AHU switch (per-user, not per-AHU).
 *   - The 220 cfm math pin still holds after starring / unstarring.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — favorites per space type', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts from clean storage so favorites don't leak across runs.
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore — private mode
      }
    });
    await page.goto('/');
  });

  test('every preset row has a star button', async ({ page }) => {
    await page.getByTestId('open-presets').click();
    const panel = page.getByTestId('preset-panel');
    const stars = panel.getByTestId('preset-star');
    const count = await stars.count();
    expect(count).toBeGreaterThan(10);
    // All stars start as unstarred (data-fav=0).
    for (let i = 0; i < count; i++) {
      await expect(stars.nth(i)).toHaveAttribute('data-fav', '0');
    }
  });

  test('clicking the star adds the row to a top-of-menu Favorites group', async ({ page }) => {
    await page.getByTestId('open-presets').click();
    const panel = page.getByTestId('preset-panel');

    // Initially: no Favorites group at all.
    await expect(panel.locator('[data-fav-group="1"]')).toHaveCount(0);

    // Star "Office space" (id=office-space).
    await page.locator('[data-preset-star-id="office-space"]').click();
    // The star flips to on.
    await expect(page.locator('[data-preset-star-id="office-space"]')).toHaveAttribute(
      'data-fav',
      '1',
    );

    // A Favorites group now exists and contains Office space.
    const favGroup = panel.locator('[data-fav-group="1"]');
    await expect(favGroup).toHaveCount(1);
    await expect(favGroup.locator('[data-preset-id="office-space"]')).toBeVisible();

    // And Office space is NO LONGER under its canonical "Office Spaces" group.
    const officeGroup = panel.locator('[data-testid="preset-group"]', {
      hasText: 'Office Spaces',
    });
    await expect(officeGroup.locator('[data-preset-id="office-space"]')).toHaveCount(0);

    // Favorites group is the FIRST group in the panel.
    const firstGroup = panel.locator('[data-testid="preset-group"]').first();
    await expect(firstGroup).toHaveAttribute('data-fav-group', '1');
  });

  test('favorites persist across closing and reopening the menu', async ({ page }) => {
    await page.getByTestId('open-presets').click();
    await page.locator('[data-preset-star-id="office-space"]').click();
    await page.locator('[data-preset-star-id="lecture-hall"]').click();

    // Close the menu.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('preset-panel')).not.toBeVisible();

    // Reopen.
    await page.getByTestId('open-presets').click();
    const favGroup = page.locator('[data-fav-group="1"]');
    await expect(favGroup.locator('[data-preset-id="office-space"]')).toBeVisible();
    await expect(favGroup.locator('[data-preset-id="lecture-hall"]')).toBeVisible();
  });

  test('favorites persist across an AHU switch (per-user, not per-AHU)', async ({ page }) => {
    // Star a preset.
    await page.getByTestId('open-presets').click();
    await page.locator('[data-preset-star-id="office-space"]').click();
    await page.keyboard.press('Escape');

    // Add a new AHU via the "+ Add unit" menu.
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // Click the new AHU tab to switch to it.
    const ahuTabs = page.locator('.ahu-tab');
    await expect(ahuTabs).toHaveCount(2);
    await ahuTabs.nth(1).click();

    // Open the preset menu on the new AHU and confirm the favorite is still there.
    await page.getByTestId('open-presets').click();
    const favGroup = page.locator('[data-fav-group="1"]');
    await expect(favGroup).toHaveCount(1);
    await expect(favGroup.locator('[data-preset-id="office-space"]')).toBeVisible();
  });

  test('unstarring removes the row from Favorites', async ({ page }) => {
    await page.getByTestId('open-presets').click();
    const star = page.locator('[data-preset-star-id="office-space"]');
    await star.click();
    await expect(star).toHaveAttribute('data-fav', '1');

    // Click again — should toggle off.
    await star.click();
    await expect(star).toHaveAttribute('data-fav', '0');

    // Favorites group is gone.
    await expect(page.locator('[data-fav-group="1"]')).toHaveCount(0);

    // And the row is back under its canonical "Office Spaces" group.
    const officeGroup = page.locator('[data-testid="preset-group"]', {
      hasText: 'Office Spaces',
    });
    await expect(officeGroup.locator('[data-preset-id="office-space"]')).toBeVisible();
  });

  test('clicking the star does NOT also apply the preset to the zone', async ({ page }) => {
    // Starring must not silently seed the zone with preset defaults.
    await page.getByTestId('open-presets').click();
    const firstZoneRow = page.locator('.zone-row').first();
    const areaBefore = await firstZoneRow.locator('input[type="number"]').nth(0).inputValue();

    await page.locator('[data-preset-star-id="office-space"]').click();

    // The menu is still open, and the zone area is unchanged.
    await expect(page.getByTestId('preset-panel')).toBeVisible();
    const areaAfter = await firstZoneRow.locator('input[type="number"]').nth(0).inputValue();
    expect(areaAfter).toBe(areaBefore);
  });

  test('220 cfm math pin still holds after favoriting', async ({ page }) => {
    // Star a preset, then run the canonical pin: Vot = 220 cfm for 1000/10.
    await page.getByTestId('open-presets').click();
    await page.locator('[data-preset-star-id="office-space"]').click();
    await page.keyboard.press('Escape');

    const rows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = rows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*220.*cfm/);
  });
});