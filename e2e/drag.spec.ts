/**
 * E2E tests for drag-to-reorder zones (P1 UX).
 *
 * Verifies:
 *   1. Mouse drag reorders zone rows (drag zone 2 above zone 1).
 *   2. compute() results (Vot, totals, per-zone Voz) are invariant under
 *      reorder — the math core doesn't depend on iteration order, so a
 *      pure reorder must not change any cfm figure.
 *   3. Keyboard accessibility (Tab + Space + ArrowUp) reorders too.
 *   4. The drag handle is invisible by default and only fades in on
 *      row hover (so the default UI stays clean).
 *   5. The 220 cfm smoke pin still holds after a reorder (end-to-end
 *      regression: same numbers the offline bundle pinned).
 *
 * Selectors:
 *   - .zone-row is the unit of reorder (one zone per row).
 *   - [data-testid="drag-<id>"] is the drag handle on each zone row.
 *   - .results-band__header h2 contains the Vot headline.
 */
import { test, expect, type Page } from '@playwright/test';

/** Configure both zones so Vot = 220 cfm (smoke pin). */
async function fillBothZonesTo220(page: Page): Promise<void> {
  const rows = page.locator('.zone-row');
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    const row = rows.nth(i);
    await row.locator('input[type="number"]').nth(0).fill('1000'); // area
    await row.locator('input[type="number"]').nth(1).fill('10'); // pop
  }
  await expect(page.locator('.results-band__header h2')).toContainText(
    /=.*220.*cfm/,
  );
}

/** Read the Vot text out of the results band header. */
async function readVotText(page: Page): Promise<string> {
  const h = page.locator('.results-band__header h2');
  return (await h.textContent()) ?? '';
}

/** Read the per-zone Voz column values (Voz is the FIRST `.num.calc`
 *  cell on each zone row — Zd is the second). Returns one entry per
 *  zone row in DOM order. */
async function readVozColumn(page: Page): Promise<string[]> {
  const tbody = page.locator('.zone-table__main tbody');
  // First .num.calc on a zone row is Voz; second is Zd. Use nth-of-type
  // via a JS evaluate so we don't depend on CSS nth-child indexing.
  return tbody.evaluate((tb) => {
    const out: string[] = [];
    for (const row of Array.from(tb.querySelectorAll('tr.zone-row'))) {
      const cells = row.querySelectorAll('td.num.calc');
      const voz = cells[0]?.textContent?.trim();
      if (voz) out.push(voz);
    }
    return out;
  });
}

test.describe('FSE Ventilation Tool — drag-to-reorder zones', () => {
  test('drag handle is hidden by default and visible on row hover', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('.zone-row');
    await expect(rows).toHaveCount(2);

    const firstHandle = page.locator('[data-testid^="drag-"]').first();
    // Opacity 0 by default — handle doesn't clutter the resting UI.
    await expect(firstHandle).toHaveCSS('opacity', '0');

    // Hover the row → handle fades in.
    await rows.first().hover();
    await expect(firstHandle).not.toHaveCSS('opacity', '0');
  });

  test('mouse drag reorders zone 2 above zone 1', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('.zone-row');
    await expect(rows).toHaveCount(2);

    // Tag inputs read TU-1-01 then TU-1-02 in seed order.
    const firstTag = rows.nth(0).locator('input.tag-input');
    const secondTag = rows.nth(1).locator('input.tag-input');
    await expect(firstTag).toHaveValue('TU-1-01');
    await expect(secondTag).toHaveValue('TU-1-02');

    // Find both drag handles by their test ids (data-testid="drag-<zoneId>").
    const handles = page.locator('[data-testid^="drag-"]');
    await expect(handles).toHaveCount(2);

    // dnd-kit uses PointerEvents. A slow drag with a few intermediate moves
    // is enough to satisfy the activation distance (4px) and trigger the
    // drop on the OTHER handle.
    const handle2 = handles.nth(1);
    const handle1 = handles.nth(0);
    const box2 = await handle2.boundingBox();
    const box1 = await handle1.boundingBox();
    if (!box2 || !box1) throw new Error('drag handles have no bounding box');

    // dnd-kit PointerSensor needs a deliberate press → small move → drag.
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    // Move enough to clear the activationConstraint distance.
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2 - 10, {
      steps: 5,
    });
    // Then drag up to the centre of the first handle (above it).
    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    // Order swapped.
    await expect(rows.nth(0).locator('input.tag-input')).toHaveValue('TU-1-02');
    await expect(rows.nth(1).locator('input.tag-input')).toHaveValue('TU-1-01');
  });

  test('compute() results are invariant under reorder — Vot stays 220 cfm', async ({ page }) => {
    await page.goto('/');
    await fillBothZonesTo220(page);

    // Capture per-zone Voz BEFORE reorder.
    const vozBefore = await readVozColumn(page);
    expect(vozBefore).toHaveLength(2);
    const votBefore = await readVotText(page);

    // Drag zone 2 above zone 1.
    const rows = page.locator('.zone-row');
    const handles = page.locator('[data-testid^="drag-"]');
    const handle2 = handles.nth(1);
    const handle1 = handles.nth(0);
    const box2 = await handle2.boundingBox();
    const box1 = await handle1.boundingBox();
    if (!box2 || !box1) throw new Error('drag handles have no bounding box');

    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2 - 10, {
      steps: 5,
    });
    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    // Order swapped
    await expect(rows.nth(0).locator('input.tag-input')).toHaveValue('TU-1-02');
    await expect(rows.nth(1).locator('input.tag-input')).toHaveValue('TU-1-01');

    // Vot text unchanged — same 220 cfm value, since only display order moved.
    const votAfter = await readVotText(page);
    expect(votAfter).toBe(votBefore);

    // Per-zone Voz numbers reordered but the SET of values is identical
    // (each zone still independently produces the same Voz).
    const vozAfter = await readVozColumn(page);
    expect(vozAfter).toHaveLength(2);
    expect([...vozAfter].sort()).toEqual([...vozBefore].sort());

    // Headline still says 220 cfm — the smoke pin survives a reorder.
    await expect(page.locator('.results-band__header h2')).toContainText(
      /=.*220.*cfm/,
    );
  });

  test('keyboard reorders: Tab to handle, Space activates, ArrowUp moves', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('.zone-row');
    await expect(rows).toHaveCount(2);

    const firstTag = rows.nth(0).locator('input.tag-input');
    const secondTag = rows.nth(1).locator('input.tag-input');
    await expect(firstTag).toHaveValue('TU-1-01');
    await expect(secondTag).toHaveValue('TU-1-02');

    // Focus the SECOND row's drag handle directly (faster + deterministic
    // than scanning the whole tab order, which is stable here but verbose).
    const secondHandle = page.locator('[data-testid^="drag-"]').nth(1);
    await secondHandle.focus();
    await expect(secondHandle).toBeFocused();

    // dnd-kit's KeyboardSensor: Space starts drag, ArrowUp moves it, Space
    // commits. Small pauses between keys let the sensor's onKeyDown handler
    // process each one before the next fires (otherwise React batch + the
    // synthetic key event can coalesce).
    await secondHandle.press('Space');
    await page.waitForTimeout(50);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');

    // Order swapped.
    await expect(rows.nth(0).locator('input.tag-input')).toHaveValue('TU-1-02');
    await expect(rows.nth(1).locator('input.tag-input')).toHaveValue('TU-1-01');
  });

  test('reorder preserves zone data — only display order changes', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('.zone-row');

    // Set distinct area/pop/vpz on each zone.
    await rows.nth(0).locator('input[type="number"]').nth(0).fill('1000'); // area
    await rows.nth(0).locator('input[type="number"]').nth(1).fill('10'); // pop
    await rows.nth(0).locator('input[type="number"]').nth(2).fill('150'); // vpz

    await rows.nth(1).locator('input[type="number"]').nth(0).fill('500'); // area
    await rows.nth(1).locator('input[type="number"]').nth(1).fill('5'); // pop
    await rows.nth(1).locator('input[type="number"]').nth(2).fill('200'); // vpz

    // Drag zone 2 above zone 1.
    const handles = page.locator('[data-testid^="drag-"]');
    const handle2 = handles.nth(1);
    const handle1 = handles.nth(0);
    const box2 = await handle2.boundingBox();
    const box1 = await handle1.boundingBox();
    if (!box2 || !box1) throw new Error('drag handles have no bounding box');

    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2 - 10, {
      steps: 5,
    });
    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    // Order swapped — but the VALUES in each row travel with their row.
    await expect(rows.nth(0).locator('input.tag-input')).toHaveValue('TU-1-02');
    await expect(rows.nth(0).locator('input[type="number"]').nth(0)).toHaveValue('500');
    await expect(rows.nth(0).locator('input[type="number"]').nth(1)).toHaveValue('5');
    await expect(rows.nth(0).locator('input[type="number"]').nth(2)).toHaveValue('200');

    await expect(rows.nth(1).locator('input.tag-input')).toHaveValue('TU-1-01');
    await expect(rows.nth(1).locator('input[type="number"]').nth(0)).toHaveValue('1000');
    await expect(rows.nth(1).locator('input[type="number"]').nth(1)).toHaveValue('10');
    await expect(rows.nth(1).locator('input[type="number"]').nth(2)).toHaveValue('150');
  });
});