/**
 * E2E tests for the multi-AHU / multi-zone / multi-room UI controls.
 * v3 — rooms render inline below each zone row (chevron expand), so we
 * scope to `.zone-row` (not just `tbody tr`) to ignore room rows and
 * the +Room sub-row. The CRIT badge appears on the room with the
 * highest Zp, plus an inline CRIT badge on the parent zone row.
 */
import { test, expect } from '@playwright/test';

test.describe('FSE Ventilation Tool — multi-unit controls', () => {
  test('AHU picker: seed shows RTU-01 tab, + Add unit, editable name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /RTU-01/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add unit/ })).toBeVisible();

    // Editable AHU name field
    const nameInput = page.getByTestId('ahu-name');
    await expect(nameInput).toHaveValue('RTU-01');
    await nameInput.fill('RTU-NORTH');
    await expect(nameInput).toHaveValue('RTU-NORTH');
    // Tab label updates
    await expect(page.getByRole('button', { name: /RTU-NORTH/ })).toBeVisible();
  });

  test('Add unit menu opens and adds a single-zone DOAS', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Add unit/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.locator('[data-add-type="singlezone"]').click();

    // New DOAS-01 tab appears and is active
    await expect(page.locator('.ahu-tab', { hasText: 'DOAS-01' })).toBeVisible();
    const active = page.locator('.ahu-tab--active');
    await expect(active).toContainText('DOAS-01');
    // Singlezone seed has one zone with tag RM-01
    await expect(
      page.locator('.zone-row td.col-tag input.tag-input').first(),
    ).toHaveValue('RM-01');
  });

  test('Add Multizone unit gets sequential RTU-NN naming', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();
    await expect(page.locator('.ahu-tab', { hasText: 'RTU-02' })).toBeVisible();

    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();
    await expect(page.locator('.ahu-tab', { hasText: 'RTU-03' })).toBeVisible();
  });

  test('Switching active AHU preserves each unit state', async ({ page }) => {
    await page.goto('/');
    const zoneRows = () => page.locator('.zone-row');

    // Edit RTU-01, zone 1 area = 1000
    await zoneRows().first().locator('input[type="number"]').nth(0).fill('1000');
    await expect(zoneRows().first().locator('input[type="number"]').nth(0)).toHaveValue('1000');

    // Add a new multizone unit
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();

    // New tab is active; its zones are the seed (area = 0)
    await expect(zoneRows().first().locator('input[type="number"]').nth(0)).toHaveValue('0');

    // Switch back to RTU-01 — area is still 1000
    await page.locator('.ahu-tab', { hasText: 'RTU-01' }).click();
    await expect(zoneRows().first().locator('input[type="number"]').nth(0)).toHaveValue('1000');
  });

  test('Cannot remove the last AHU (× button is hidden)', async ({ page }) => {
    await page.goto('/');
    // With only one AHU the close × on the tab is hidden
    await expect(page.locator('.ahu-tab__close')).toHaveCount(0);
  });

  test('Removing an AHU switches activeId to a remaining unit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Add unit/ }).click();
    await page.locator('[data-add-type="multizone"]').click();
    // Now both RTU-01 and RTU-02 have close buttons
    await expect(page.locator('.ahu-tab__close')).toHaveCount(2);
    // Active is RTU-02 — remove it, active should fall back to RTU-01
    await page.locator('[data-ahu-remove]').last().click();
    await expect(page.locator('.ahu-tab__close')).toHaveCount(0);
    await expect(page.locator('.ahu-tab--active')).toContainText('RTU-01');
  });
});

test.describe('FSE Ventilation Tool — zone / room controls', () => {
  test('Add zone adds a TU-NN row', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('.zone-row').count();
    await page.getByTestId('add-zone').click();
    const after = await page.locator('.zone-row').count();
    expect(after).toBe(before + 1);
    // New zone row's tag input is TU-03
    await expect(
      page.locator('.zone-row').last().locator('input.tag-input'),
    ).toHaveValue('TU-03');
  });

  test('Remove zone drops the matching row', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('.zone-row').count();
    await page.locator('[data-remove-zone]').first().click();
    const after = await page.locator('.zone-row').count();
    expect(after).toBe(before - 1);
  });

  test('Reset zones restores the two-TU seed', async ({ page }) => {
    await page.goto('/');
    // Edit a tag, add a zone, then reset
    await page.getByTestId('add-zone').click();
    await page.getByRole('button', { name: /Reset zones/ }).click();
    await expect(page.locator('.zone-row')).toHaveCount(2);
    await expect(
      page.locator('.zone-row').first().locator('input.tag-input'),
    ).toHaveValue('TU-1-01');
  });

  test('No global Rooms toggle — rooms are revealed by chevron expand', async ({ page }) => {
    await page.goto('/');
    // The global Rooms toggle is gone in v3.
    await expect(page.getByTestId('rooms-toggle')).toHaveCount(0);

    // No room rows visible by default
    await expect(page.locator('[data-room-row]')).toHaveCount(0);

    // Open the first zone via chevron
    await page.locator('[data-testid^="chev-"]').first().click();
    // The + Room sub-row appears under the zone
    await expect(page.getByTestId('add-room').first()).toBeVisible();

    // Add a room
    await page.getByTestId('add-room').first().click();
    await expect(page.locator('[data-room-row]')).toHaveCount(1);

    // Remove the room
    await page.locator('[data-room-remove]').first().click();
    await expect(page.locator('[data-room-row]')).toHaveCount(0);

    // The + Room sub-row is still visible because chevron is open
    await expect(page.getByTestId('add-room').first()).toBeVisible();

    // Closing the chevron hides the + Room sub-row
    await page.locator('[data-testid^="chev-"]').first().click();
    await expect(page.getByTestId('add-room')).toHaveCount(0);
  });

  test('Critical-room badge appears on the room with the highest Zp; inline CRIT on parent zone row', async ({ page }) => {
    await page.goto('/');
    // Open the first zone
    await page.locator('[data-testid^="chev-"]').first().click();

    // Add 2 rooms to the first zone
    await page.getByTestId('add-room').first().click();
    await page.getByTestId('add-room').first().click();

    // First room (row 0): area 500, pop 5 → Rp·Pz + Ra·Az = 5·5 + 0.06·500 = 55, Voz = 55, vpz 150 → Zp = 55/150 = 0.367
    const r0 = page.locator('[data-room-row]').nth(0);
    await r0.locator('input[type="number"]').nth(0).fill('500');
    await r0.locator('input[type="number"]').nth(1).fill('5');
    await r0.locator('input[type="number"]').nth(2).fill('150');

    // Second room: area 1000, pop 10 → 5·10 + 0.06·1000 = 110, Voz = 110, vpz 150 → Zp = 0.733 (HIGHER → CRIT)
    const r1 = page.locator('[data-room-row]').nth(1);
    await r1.locator('input[type="number"]').nth(0).fill('1000');
    await r1.locator('input[type="number"]').nth(1).fill('10');
    await r1.locator('input[type="number"]').nth(2).fill('150');

    // Second room row has CRIT badge
    await expect(r1.locator('.crit-badge')).toBeVisible();
    await expect(r0.locator('.crit-badge')).toHaveCount(0);

    // Inline CRIT badge appears on the parent zone row (in Voz cell)
    const firstZoneRow = page.locator('.zone-row').first();
    await expect(firstZoneRow.locator('.crit-badge--inline')).toBeVisible();
  });
});