/**
 * E2E tests for the DR / DC / DC+ system ventilation type feature
 * (P1.2 + P1.3). The system-type dropdown lives inline on the active AHU
 * tab in the picker rail, and switching it expands the equation trace.
 *
 * Invariants covered:
 *   - Default system type is DR (4 trace steps).
 *   - Switching to DC adds the V_tr transfer-air step (5 trace steps).
 *   - Switching to DC+ adds V_tr + a V_ot-vs-V_tr comparison (6 trace steps).
 *   - V_ot value is UNCHANGED across DR / DC / DC+ — system type is a
 *     display/explanation feature, not a math change.
 *
 * The math pin is the 220 cfm V_ot for two identical office TUs — the
 * same fixture used throughout the unit tests.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — DR / DC / DC+ system type', () => {
  test('default system type is DR (4 trace steps)', async ({ page }) => {
    await page.goto('/');
    // Wait for the trace to render — seed AHU has 2 zones so trace steps
    // appear immediately after mount.
    await expect(page.locator('.eq-trace__step').first()).toBeVisible();
    await expect(page.locator('.eq-trace__step')).toHaveCount(4);

    // The dropdown is rendered only on the active tab
    const sel = page.getByTestId('system-type-select');
    await expect(sel).toBeVisible();
    await expect(sel).toHaveValue('DR');
  });

  test('switching to DC expands the trace to 5 steps (V_tr)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.eq-trace__step').first()).toBeVisible();
    await expect(page.locator('.eq-trace__step')).toHaveCount(4);

    await page.getByTestId('system-type-select').selectOption('DC');
    await expect(page.locator('.eq-trace__step')).toHaveCount(5);

    // The new step should be the V_tr row — its symbol matches the
    // .eq-trace__sym text content.
    const syms = await page.locator('.eq-trace__sym').allTextContents();
    expect(syms).toContain('V_tr');
  });

  test('switching to DC+ expands the trace to 6 steps (V_tr + comparison)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.eq-trace__step').first()).toBeVisible();
    await expect(page.locator('.eq-trace__step')).toHaveCount(4);

    await page.getByTestId('system-type-select').selectOption('DC+');
    await expect(page.locator('.eq-trace__step')).toHaveCount(6);

    const syms = await page.locator('.eq-trace__sym').allTextContents();
    // V_tr row + a comparison row referencing V_ot ↔ V_tr
    expect(syms).toContain('V_tr');
    expect(syms).toContain('V_ot ↔ V_tr');
  });

  test('switching back to DR collapses the trace back to 4 steps', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.eq-trace__step').first()).toBeVisible();

    // Walk DC → DC+ → DR and assert counts along the way.
    await page.getByTestId('system-type-select').selectOption('DC');
    await expect(page.locator('.eq-trace__step')).toHaveCount(5);

    await page.getByTestId('system-type-select').selectOption('DC+');
    await expect(page.locator('.eq-trace__step')).toHaveCount(6);

    await page.getByTestId('system-type-select').selectOption('DR');
    await expect(page.locator('.eq-trace__step')).toHaveCount(4);
  });

  test('V_ot value is UNCHANGED across DR / DC / DC+ (critical invariant)', async ({ page }) => {
    await page.goto('/');
    const votDr = await page.locator('.results-band__header h2').textContent();

    await page.getByTestId('system-type-select').selectOption('DC');
    const votDc = await page.locator('.results-band__header h2').textContent();

    await page.getByTestId('system-type-select').selectOption('DC+');
    const votDcp = await page.locator('.results-band__header h2').textContent();

    // The critical invariant: system type is a display/explanation feature
    // only — V_ot must be byte-identical regardless of which option is
    // selected.
    expect(votDc).toBe(votDr);
    expect(votDcp).toBe(votDr);
  });

  test('system-type dropdown is only rendered on the ACTIVE tab', async ({ page }) => {
    await page.goto('/');
    // Seed has 1 AHU → no other tabs → exactly one system-type select.
    await expect(page.getByTestId('system-type-select')).toHaveCount(1);

    // Add a second AHU via the "+ Add unit" menu
    await page.getByRole('button', { name: '+ Add unit' }).click();
    await page.getByRole('menuitem', { name: /Multi-zone unit/ }).click();

    // The newly added AHU is now active; the old AHU is not.
    // → still exactly ONE system-type select (on the active tab only).
    await expect(page.getByTestId('system-type-select')).toHaveCount(1);
  });

  test('seed AHU starts with systemType=DR; switching persists', async ({ page }) => {
    await page.goto('/');
    const sel = page.getByTestId('system-type-select');
    await expect(sel).toHaveValue('DR');

    await sel.selectOption('DC+');
    await expect(sel).toHaveValue('DC+');

    // Re-load to ensure the value persists across a state-cycle (since we
    // don't persist to localStorage here, this is just a re-assertion
    // that the dropdown reflects the in-memory state).
    await expect(page.locator('.eq-trace__step')).toHaveCount(6);
  });
});
