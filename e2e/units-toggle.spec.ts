/**
 * E2E tests for the IP/SI units toggle button (P0.3).
 *
 * Math layer stays I-P canonical. The toggle is a display preference only:
 * clicking it changes how values are rendered (cfm ↔ m³/s, ft² ↔ m²) and
 * the choice persists in localStorage so an engineer who set SI doesn't
 * have to flip it back on every reload.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — units toggle', () => {
  test('default is IP', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('units-toggle')).toHaveText('IP');
  });

  test('clicking toggle switches to SI and updates the Results band display', async ({ page }) => {
    await page.goto('/');

    // Fill the first zone with the canonical smoke-test inputs
    // (area=1000 ft², pop=10 → Voz = 110 cfm per zone; total Vou=220 cfm).
    const zoneRows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = zoneRows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }
    // Confirm I-P baseline — Vot header reads "= 220 cfm"
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*220.*cfm/);

    // Flip to SI
    await page.getByTestId('units-toggle').click();
    await expect(page.getByTestId('units-toggle')).toHaveText('SI');

    // Now the band should display m³/s. 220 cfm ≈ 0.104 m³/s.
    await expect(page.locator('.results-band__header h2')).toContainText('m³/s');
    await expect(page.locator('.results-band')).toContainText('m³/s');
  });

  test('SI mode persists across reload (localStorage)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('units-toggle').click(); // IP → SI
    await expect(page.getByTestId('units-toggle')).toHaveText('SI');

    await page.reload();

    await expect(page.getByTestId('units-toggle')).toHaveText('SI');
    // localStorage key is versioned (fse.vent.units.v1)
    const stored = await page.evaluate(() => window.localStorage.getItem('fse.vent.units.v1'));
    expect(stored).toBe('si');
  });

  test('toggle is independent of theme', async ({ page }) => {
    await page.goto('/');
    const units = page.getByTestId('units-toggle');
    const theme = page.getByRole('button', { name: /light|dark/i });

    // Flip both, several times, verify neither breaks the other
    await theme.click(); // light → dark
    await units.click(); // IP → SI
    await expect(page.locator('.app')).toHaveClass(/dark/);
    await expect(units).toHaveText('SI');

    await theme.click(); // dark → light
    await units.click(); // SI → IP
    await expect(page.locator('.app')).not.toHaveClass(/dark/);
    await expect(units).toHaveText('IP');

    // Flip only theme — units should remain on IP
    await theme.click();
    await expect(units).toHaveText('IP');

    // Flip only units — theme should remain dark
    await units.click();
    await expect(page.locator('.app')).toHaveClass(/dark/);
    await expect(units).toHaveText('SI');
  });

  test('area input shows ft²/m² suffix that follows the toggle', async ({ page }) => {
    await page.goto('/');
    const firstZone = page.locator('.zone-row').first();
    const suffix = firstZone.locator('[data-testid^="area-unit-suffix-"]');

    // Default I-P
    await expect(suffix).toHaveText('ft²');

    // Flip to SI
    await page.getByTestId('units-toggle').click();
    await expect(suffix).toHaveText('m²');

    // Column header sub-label tracks the toggle too
    await expect(page.locator('.zone-table__main thead .th-sub').first()).toHaveText('m²');
  });
});
