/**
 * E2E tests for the multi-AHU Excel export.
 *
 * Closes the P0 backlog item: the Export button used to key off the active
 * AHU only. With the refactor it produces a single workbook containing one
 * sheet-set (Inputs / Calc / Summary) per AHU, and the active AHU's tabs
 * get a yellow tab color.
 *
 * What we verify end-to-end:
 *   - Clicking Export triggers a real .xlsx download (Playwright download event)
 *   - The downloaded file is a valid xlsx with the expected sheet count
 *     (3 × N AHUs) — read back through ExcelJS
 *
 * Tab color verification happens at the unit level (see
 * `src/lib/__tests__/excelExport.test.ts`) — Playwright can't introspect
 * an .xlsx tab color from the DOM. Instead, the e2e tests confirm that
 * the active sheet names round-trip from the live AHU list.
 */
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import type { Workbook as ExcelWorkbook } from 'exceljs';

async function downloadExport(page: import('@playwright/test').Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export \.xlsx/ }).click(),
  ]);
  // The component names the file `fse-ventilation-YYYY-MM-DD.xlsx`
  expect(download.suggestedFilename()).toMatch(/^fse-ventilation-\d{4}-\d{2}-\d{2}\.xlsx$/);
  return download;
}

/**
 * Read a downloaded xlsx from disk into an ExcelJS Workbook.
 *
 * ExcelJS is a UMD module — under Node ESM the default import gives the
 * namespace object, not the legacy `ExcelJS.xlsx.readFile` shim. We use
 * `new ExcelJS.Workbook()` + `.xlsx.readFile()` which is the supported
 * path on every environment.
 */
async function loadWorkbookFromDownload(
  download: import('@playwright/test').Download,
): Promise<ExcelWorkbook> {
  const path = await download.path();
  if (!path) throw new Error('download did not yield a filesystem path');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

test.describe('FSE Ventilation Tool — multi-AHU Excel export', () => {
  test('Export button triggers an .xlsx download', async ({ page }) => {
    await page.goto('/');
    const download = await downloadExport(page);
    const wb = await loadWorkbookFromDownload(download);
    // Single-AHU seed → 3 sheets (legacy three-sheet shape)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'RTU-01 - Inputs',
      'RTU-01 - Calc',
      'RTU-01 - Summary',
    ]);
  });

  test('Export with two AHUs produces 6 sheets in declaration order', async ({ page }) => {
    await page.goto('/');

    // Add a second multizone unit
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // Now RTU-01 and RTU-02 both exist; RTU-02 is active
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-02');

    const download = await downloadExport(page);
    const wb = await loadWorkbookFromDownload(download);

    const names = wb.worksheets.map((w) => w.name);
    expect(names).toHaveLength(6);
    expect(names).toEqual([
      'RTU-01 - Inputs',
      'RTU-01 - Calc',
      'RTU-01 - Summary',
      'RTU-02 - Inputs',
      'RTU-02 - Calc',
      'RTU-02 - Summary',
    ]);
  });

  test('Each AHU gets its own Inputs sheet with the right header', async ({ page }) => {
    await page.goto('/');

    // Add a second unit
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // Rename the active (RTU-02) so we can verify the name round-trips
    const activeTab = page.locator('.ahu-tab--active');
    await activeTab.locator('.ahu-tab__name').dblclick();
    await page.locator('.ahu-tab__name-input').fill('DOAS-NORTH');
    await page.locator('.ahu-tab__name-input').press('Enter');

    const download = await downloadExport(page);
    const wb = await loadWorkbookFromDownload(download);

    const rtu01Inputs = wb.getWorksheet('RTU-01 - Inputs');
    const doasInputs = wb.getWorksheet('DOAS-NORTH - Inputs');
    expect(rtu01Inputs).toBeDefined();
    expect(doasInputs).toBeDefined();

    // Both Inputs sheets have the same canonical header
    const expected = [
      'Tag',
      'Space',
      'Area (ft²)',
      'Pop',
      'Vpz (cfm)',
      'Vdz (cfm)',
      'Vdzm (cfm)',
      'Ez config',
    ];
    const headerRow = (ws: ExcelJS.Worksheet): string[] => {
      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
        headers.push(String(cell.value ?? ''));
      });
      return headers;
    };
    expect(headerRow(rtu01Inputs!)).toEqual(expected);
    expect(headerRow(doasInputs!)).toEqual(expected);
  });

  test('Summary sheet contains the AHU Vot', async ({ page }) => {
    await page.goto('/');

    // Seed RTU-01: each zone Area=1000, Pop=10. Office space → Rp=5, Ra=0.06.
    // Vbz per zone = 5·10 + 0.06·1000 = 110 cfm. Two zones → Vou=220, Vot=220.
    const rows = page.locator('.zone-row');
    for (const r of await rows.all()) {
      const inputs = r.locator('input[type="number"]');
      await inputs.nth(0).fill('1000');
      await inputs.nth(1).fill('10');
    }

    const download = await downloadExport(page);
    const wb = await loadWorkbookFromDownload(download);
    const summary = wb.getWorksheet('RTU-01 - Summary');
    expect(summary).toBeDefined();

    // Walk the key column and find the Vot row
    const keyValues: Array<string | undefined> =
      (summary!.getColumn(1).values as Array<string | undefined>) ?? [];
    const votRowIdx = keyValues.indexOf('Vot');
    expect(votRowIdx).toBeGreaterThan(0);
    const votValue = summary!.getRow(votRowIdx + 1).getCell(2).value;
    expect(Number(votValue)).toBeCloseTo(220, 0);
  });
});