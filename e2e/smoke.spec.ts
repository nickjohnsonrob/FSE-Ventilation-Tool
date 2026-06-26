import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — smoke', () => {
  test('loads and renders the calculator shell', async ({ page }) => {
    await page.goto('/');

    // Header + subtitle
    await expect(page.getByRole('heading', { name: 'FSE Ventilation Calculation' })).toBeVisible();
    await expect(page.getByText(/ANSI\/ASHRAE 62\.1-2022/)).toBeVisible();

    // Method switcher is visible (Appendix A by default)
    await expect(page.getByRole('tab', { name: /Appendix A/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Simplified/ })).toBeVisible();

    // Zone table renders with at least one row
    const tableRows = page.locator('.zone-table tbody tr');
    await expect(tableRows.first()).toBeVisible();

    // Results band — heading "V_ot = 0 cfm" is visible (empty inputs → Vot=0).
    // The DOM has <h2>V<sub>ot</sub> = 0 cfm</h2> — use the role/textContent form.
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*0.*cfm/);
  });

  test('changing both zones populates Vot to Vou', async ({ page }) => {
    await page.goto('/');

    const rows = page.locator('.zone-table tbody tr');
    // Set Area = 1000 ft², Pop = 10 on BOTH rows (Office space: Rp=5, Ra=0.06).
    // Each zone: Vbz = 5·10 + 0.06·1000 = 110 cfm, Voz = 110 cfm.
    // Total Vou = 220 cfm; Ev (Appendix A) = 1; Vot = 220 cfm.
    for (let i = 0; i < 2; i++) {
      const row = rows.nth(i);
      await row.locator('input[type="number"]').nth(0).fill('1000'); // area
      await row.locator('input[type="number"]').nth(1).fill('10'); // pop
    }
    await expect(page.locator('.results-band__header h2')).toContainText(/=.*220.*cfm/);
  });

  test('theme toggle flips light ↔ dark', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /light|dark/i });

    // Start in light mode → toggle should switch to dark
    const appBefore = page.locator('.app');
    await expect(appBefore).not.toHaveClass(/dark/);
    await toggle.click();
    await expect(appBefore).toHaveClass(/dark/);
    await toggle.click();
    await expect(appBefore).not.toHaveClass(/dark/);
  });

  test('Ez help dialog opens and closes', async ({ page }) => {
    await page.goto('/');
    const helpBtn = page.getByRole('button', { name: '?', exact: true }).first();
    await helpBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Heading inside the dialog specifically (footer also mentions "Table 6-2")
    await expect(page.getByRole('heading', { name: /Table 6-2/ })).toBeVisible();
    // Close via the Close button
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('switching to Simplified shows both procedure options', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /Simplified/ }).click();
    const tab = page.getByRole('tab', { name: /Simplified/ });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    // Both simplified procedures appear as radio options
    await expect(page.getByText(/Table 6-3 breakpoints/)).toBeVisible();
    await expect(page.getByText(/Eq\. 6-7.*6-8.*D-formula/)).toBeVisible();
  });

  test('engineer-disclaimer footer is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/design aid/i)).toBeVisible();
    await expect(page.getByText(/qualified engineer/i)).toBeVisible();
  });
});
