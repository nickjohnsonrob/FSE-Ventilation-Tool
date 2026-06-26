/**
 * E2E tests for the analysis row: per-zone efficiency chart and equation
 * trace. These verify the v1.0.0 features that the modernized build
 * previously dropped, restored in feature/eff-trace.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — analysis row', () => {
  test('Efficiency chart: multizone Appendix A renders Evz bars sorted low→high, critical highlighted', async ({
    page,
  }) => {
    await page.goto('/');
    // Default seed is multizone Appendix A with two empty zones — drive both
    // zones so we get a non-trivial Evz comparison.
    const rows = () => page.locator('.zone-row');
    await rows().nth(0).locator('input[type="number"]').nth(0).fill('1000'); // Az
    await rows().nth(0).locator('input[type="number"]').nth(1).fill('20'); // Pz
    await rows().nth(0).locator('input[type="number"]').nth(2).fill('800'); // Vpz
    await rows().nth(0).locator('input[type="number"]').nth(3).fill('800'); // Vdz
    await rows().nth(0).locator('input[type="number"]').nth(4).fill('300'); // Vdzm
    await rows().nth(1).locator('input[type="number"]').nth(0).fill('2000');
    await rows().nth(1).locator('input[type="number"]').nth(1).fill('40');
    await rows().nth(1).locator('input[type="number"]').nth(2).fill('1500');
    await rows().nth(1).locator('input[type="number"]').nth(3).fill('1500');
    await rows().nth(1).locator('input[type="number"]').nth(4).fill('500');

    const chart = page.locator('.eff-chart-card');
    await expect(chart).toBeVisible();
    await expect(chart.locator('.eff-chart-card__title')).toHaveText(
      /Zone ventilation efficiency Evz/i,
    );

    // Exactly one bar gets the --crit highlight (the lowest-Evz zone)
    await expect(chart.locator('.eff-chart__bar--crit')).toHaveCount(1);
    // Both zones have bars
    const bars = chart.locator('.eff-chart__bar');
    await expect(bars).toHaveCount(2);

    // Toggle collapse / re-expand
    await page.getByTestId('eff-chart-toggle').click();
    await expect(chart.locator('.eff-chart')).toHaveCount(0);
    await page.getByTestId('eff-chart-toggle').click();
    await expect(chart.locator('.eff-chart')).toBeVisible();
  });

  test('Efficiency chart hides for single-zone units', async ({ page }) => {
    await page.goto('/');
    // Add a single-zone unit
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="singlezone"]').click();

    // No chart card visible
    await expect(page.locator('.eff-chart-card')).toHaveCount(0);
    // But the trace panel still renders
    await expect(page.locator('.eq-trace')).toBeVisible();
  });

  test('Equation trace renders Voz → Zd → Evz → Vot steps for the critical zone', async ({
    page,
  }) => {
    await page.goto('/');
    // Make both zones meaningful
    const rows = () => page.locator('.zone-row');
    await rows().nth(0).locator('input[type="number"]').nth(0).fill('1000');
    await rows().nth(0).locator('input[type="number"]').nth(1).fill('20');
    await rows().nth(0).locator('input[type="number"]').nth(2).fill('800');
    await rows().nth(0).locator('input[type="number"]').nth(3).fill('800');
    await rows().nth(0).locator('input[type="number"]').nth(4).fill('300');
    await rows().nth(1).locator('input[type="number"]').nth(0).fill('2000');
    await rows().nth(1).locator('input[type="number"]').nth(1).fill('40');
    await rows().nth(1).locator('input[type="number"]').nth(2).fill('1500');
    await rows().nth(1).locator('input[type="number"]').nth(3).fill('1500');
    await rows().nth(1).locator('input[type="number"]').nth(4).fill('500');

    const trace = page.locator('.eq-trace');
    await expect(trace).toBeVisible();

    // For single-duct zones (default box), no fan-powered Ep/Fa/Fb/Fc
    // step — only Voz, Zd, Evz, Vot. (Set box=series to get all 6 steps.)
    const steps = trace.locator('.eq-trace__step');
    await expect(steps).toHaveCount(4);

    // Symbol labels appear in the order above
    await expect(trace.locator('.eq-trace__sym').nth(0)).toHaveText('Voz');
    await expect(trace.locator('.eq-trace__sym').nth(1)).toHaveText('Zd');
    await expect(trace.locator('.eq-trace__sym').nth(2)).toHaveText('Evz');
    await expect(trace.locator('.eq-trace__sym').nth(3)).toHaveText('Vot');

    // The Vot step uses the 'ok' tone
    await expect(trace.locator('.eq-trace__out--ok')).toBeVisible();
    // And it ends with " cfm"
    await expect(trace.locator('.eq-trace__out--ok')).toContainText('cfm');

    // Note mentions which zone is critical
    await expect(trace.locator('.eq-trace__note')).toContainText(/critical/i);

    // The select lets us switch zones
    await expect(page.getByTestId('eq-trace-select')).toBeVisible();
  });
});