/**
 * E2E tests for the DR/DC/DC+ system-type dropdown on the AHU picker.
 *
 * The dropdown lives on the ACTIVE AHU tab only (system type is a
 * per-AHU choice). Switching it re-shapes the EquationTrace:
 *
 *   DR   — 4 steps (Voz, Zd, Evz, Vot)
 *   DC   — 5 steps (+ V_tr)
 *   DC+  — 6 steps (+ V_tr + V_ot ↔ V_tr comparison)
 *
 * Critically, the math (Vot, Vou, Xs, Ev) is byte-identical across all
 * three — only the trace rendering changes. We pin that contract here.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — system-type dropdown (DR / DC / DC+)', () => {
  test('default system type is DR (4 trace steps)', async ({ page }) => {
    await page.goto('/');

    // Seed the canonical 2-zone 1000-ft²/10-people office fixture so
    // the trace has real numbers.
    const zoneRows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = zoneRows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }

    // Default value of the select is DR
    await expect(page.getByTestId('system-type-select')).toHaveValue('DR');

    // 4 trace steps: Voz, Zd, Evz, Vot
    const steps = page.locator('[data-testid="eq-trace-steps"] .eq-trace__step');
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0).locator('.eq-trace__sym')).toHaveText('Voz');
    await expect(steps.nth(1).locator('.eq-trace__sym')).toHaveText('Zd');
    await expect(steps.nth(2).locator('.eq-trace__sym')).toHaveText('Evz');
    await expect(steps.nth(3).locator('.eq-trace__sym')).toHaveText('Vot');
  });

  test('switching to DC adds V_tr step (5 trace steps)', async ({ page }) => {
    await page.goto('/');

    const zoneRows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = zoneRows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }

    // Switch to DC
    await page.getByTestId('system-type-select').selectOption('DC');
    await expect(page.getByTestId('system-type-select')).toHaveValue('DC');

    // 5 trace steps: Voz, Zd, Evz, Vot, V_tr
    const steps = page.locator('[data-testid="eq-trace-steps"] .eq-trace__step');
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(4).locator('.eq-trace__sym')).toHaveText('V_tr');
  });

  test('switching to DC+ adds V_tr + comparison (6 trace steps)', async ({ page }) => {
    await page.goto('/');

    const zoneRows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = zoneRows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }

    // Switch to DC+
    await page.getByTestId('system-type-select').selectOption('DC+');
    await expect(page.getByTestId('system-type-select')).toHaveValue('DC+');

    // 6 trace steps: Voz, Zd, Evz, Vot, V_tr, V_ot ↔ V_tr
    const steps = page.locator('[data-testid="eq-trace-steps"] .eq-trace__step');
    await expect(steps).toHaveCount(6);
    await expect(steps.nth(4).locator('.eq-trace__sym')).toHaveText('V_tr');
    await expect(steps.nth(5).locator('.eq-trace__sym')).toContainText('V_ot');
    await expect(steps.nth(5).locator('.eq-trace__sym')).toContainText('V_tr');
  });

  test('V_ot value is UNCHANGED across DR / DC / DC+', async ({ page }) => {
    await page.goto('/');

    // Seed the canonical fixture: Vou=220, Vot=220, Ev=1.
    const zoneRows = page.locator('.zone-row');
    for (let i = 0; i < 2; i++) {
      const row = zoneRows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000');
      await row.locator('input[type="number"]').nth(1).fill('10');
    }

    // Pin the Results band header reading across all three settings.
    const header = page.locator('.results-band__header h2');

    // DR
    await expect(page.getByTestId('system-type-select')).toHaveValue('DR');
    await expect(header).toContainText(/=.*220.*cfm/);

    // DC
    await page.getByTestId('system-type-select').selectOption('DC');
    await expect(header).toContainText(/=.*220.*cfm/);

    // DC+
    await page.getByTestId('system-type-select').selectOption('DC+');
    await expect(header).toContainText(/=.*220.*cfm/);

    // Back to DR — still 220
    await page.getByTestId('system-type-select').selectOption('DR');
    await expect(header).toContainText(/=.*220.*cfm/);
  });

  test('switching system type does not change the active AHU', async ({ page }) => {
    await page.goto('/');

    // Add a second AHU so we can verify activeId is preserved when we
    // open the dropdown on the FIRST (inactive) AHU's tab is not the
    // case — but the dropdown only lives on the ACTIVE tab. So we
    // verify that interacting with the dropdown on the active tab does
    // not cause a tab switch.
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // Active is RTU-02 now
    const activeTab = page.locator('.ahu-tab--active');
    await expect(activeTab).toContainText('RTU-02');

    // Cycle the dropdown through DC, DC+, DR — RTU-02 stays active
    await page.getByTestId('system-type-select').selectOption('DC');
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-02');

    await page.getByTestId('system-type-select').selectOption('DC+');
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-02');

    await page.getByTestId('system-type-select').selectOption('DR');
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-02');

    // RTU-01 chip is still visible (untouched)
    await expect(page.locator('.ahu-tab', { hasText: 'RTU-01' })).toBeVisible();
  });
});
